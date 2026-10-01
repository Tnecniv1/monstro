import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePushResults, sendExpoPush, type ExpoPushMessage } from "../_shared/expoPush.ts";

// Notifications push du forum, appelée par deux Database Webhooks (INSERT) :
// - forum_messages : réponse dans une question → auteur + participants ;
// - forum_tickets (topic_id null) : nouvelle question → admins.
// Les tickets des topics de sens (topic_id renseigné) ne notifient personne.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TITRE = "Forum";

// Espace insécable, comme dans les textes de l'app (avant : et à l'intérieur
// des guillemets français).
const NBSP = String.fromCharCode(0xa0);

const SUJET_LABEL: Record<string, string> = {
  probleme: "Problème",
  methode: "Méthode",
  application: "Application",
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown> | null;
};

type Destinataire = { id: string; push_token: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Comparaison à temps constant, pour ne pas révéler le secret par le temps
// de réponse.
function secretValide(recu: string | null, attendu: string): boolean {
  if (recu == null) return false;
  const a = new TextEncoder().encode(recu);
  const b = new TextEncoder().encode(attendu);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function envoyer(
  destinataires: Destinataire[],
  body: string,
  data: Record<string, unknown>,
  logPrefix: string,
) {
  if (destinataires.length === 0) {
    console.log(`${logPrefix} aucun destinataire`);
    return { destinataires: 0, envoyes: 0, tokensInvalides: 0 };
  }

  const messages: ExpoPushMessage[] = destinataires.map((d) => ({
    to: d.push_token,
    title: TITRE,
    body,
    sound: "default",
    data,
  }));
  const results = await sendExpoPush(messages, logPrefix);
  const outcomes = await handlePushResults(
    supabase,
    results.map((result, i) => ({ userId: destinataires[i].id, result })),
    logPrefix,
  );

  return {
    destinataires: destinataires.length,
    envoyes: outcomes.filter((o) => o.statut === "ok").length,
    tokensInvalides: outcomes.filter((o) => o.statut === "device_not_registered").length,
  };
}

// Réponse dans une question : auteur du ticket + toute personne ayant déjà
// écrit dans le ticket, sauf l'expéditeur.
async function surNouveauMessage(record: Record<string, unknown>) {
  const ticketId = record.ticket_id as string | undefined;
  const expediteurId = record.user_id as string | undefined;
  const logPrefix = `[forum_messages ${record.id}]`;
  if (!ticketId || !expediteurId) return { ignore: "record incomplet" };

  const { data: ticket, error: ticketError } = await supabase
    .from("forum_tickets")
    .select("id, titre, user_id, topic_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketError) throw ticketError;
  if (!ticket) return { ignore: "ticket introuvable" };
  if (ticket.topic_id != null) return { ignore: "ticket de topic de sens" };

  const { data: participants, error: participantsError } = await supabase
    .from("forum_messages")
    .select("user_id")
    .eq("ticket_id", ticketId);
  if (participantsError) throw participantsError;

  const ids = new Set<string>([ticket.user_id, ...(participants ?? []).map((p) => p.user_id as string)]);
  ids.delete(expediteurId);
  if (ids.size === 0) return { destinataires: 0, envoyes: 0, tokensInvalides: 0 };

  const [{ data: destinataires, error: destError }, { data: expediteur }] = await Promise.all([
    supabase
      .from("user_profile")
      .select("id, push_token")
      .in("id", Array.from(ids))
      .eq("notifications_actives", true)
      .not("push_token", "is", null),
    supabase.from("user_profile").select("pseudo").eq("id", expediteurId).maybeSingle(),
  ]);
  if (destError) throw destError;

  const pseudo = (expediteur?.pseudo as string | null) || "Quelqu'un";
  const body = `${pseudo} a répondu à «${NBSP}${ticket.titre}${NBSP}»`;
  return await envoyer(
    (destinataires ?? []) as Destinataire[],
    body,
    { type: "forum_reply", ticketId },
    logPrefix,
  );
}

// Nouvelle question (topic_id null) : tous les admins, sauf l'auteur.
async function surNouveauTicket(record: Record<string, unknown>) {
  const logPrefix = `[forum_tickets ${record.id}]`;
  if (record.topic_id != null) return { ignore: "ticket de topic de sens" };

  const ticketId = record.id as string;
  const auteurId = record.user_id as string;
  const titre = record.titre as string;
  const sujet = SUJET_LABEL[record.sujet as string];

  const { data: admins, error } = await supabase
    .from("user_profile")
    .select("id, push_token")
    .eq("role", "admin")
    .eq("notifications_actives", true)
    .not("push_token", "is", null)
    .neq("id", auteurId);
  if (error) throw error;

  const body = sujet
    ? `Nouvelle question (${sujet})${NBSP}: ${titre}`
    : `Nouvelle question${NBSP}: ${titre}`;
  return await envoyer(
    (admins ?? []) as Destinataire[],
    body,
    { type: "forum_ticket", ticketId },
    logPrefix,
  );
}

serve(async (req) => {
  const attendu = Deno.env.get("FORUM_WEBHOOK_SECRET");
  if (!attendu || !secretValide(req.headers.get("x-webhook-secret"), attendu)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "INSERT" || !payload.record) {
      return json({ ignore: `événement ${payload.type} non traité` });
    }

    if (payload.table === "forum_messages") return json(await surNouveauMessage(payload.record));
    if (payload.table === "forum_tickets") return json(await surNouveauTicket(payload.record));
    return json({ ignore: `table ${payload.table} non traitée` });
  } catch (err) {
    console.error("Erreur forum-notifications:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
