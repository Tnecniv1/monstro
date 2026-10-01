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

// Payload d'un Database Webhook Supabase : type en majuscules, table sans le
// schéma, record = la ligne insérée.
type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
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
  console.log(`${logPrefix} envoi à ${destinataires.length} destinataire(s) : ${destinataires.map((d) => d.id).join(", ")}`);
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

type ProfilPush = { id: string; notifications_actives: boolean | null; push_token: string | null };

// Filtres appliqués en JS (et non dans la requête) pour journaliser le nombre
// de destinataires restant après chacun : notifications_actives, push_token.
function filtrerDestinataires(profils: ProfilPush[], logPrefix: string): Destinataire[] {
  const actifs = profils.filter((p) => p.notifications_actives === true);
  console.log(`${logPrefix} après filtre notifications_actives=true : ${actifs.length}`);
  const avecToken = actifs.filter((p) => !!p.push_token);
  console.log(`${logPrefix} après filtre push_token non null : ${avecToken.length}`);
  return avecToken.map((p) => ({ id: p.id, push_token: p.push_token as string }));
}

function sortie(logPrefix: string, raison: string) {
  console.log(`${logPrefix} SORTIE — ${raison}`);
  return { ignore: raison };
}

// Réponse dans une question : auteur du ticket + toute personne ayant déjà
// écrit dans le ticket, sauf l'expéditeur.
async function surNouveauMessage(record: Record<string, unknown>) {
  const ticketId = record.ticket_id as string | undefined;
  const expediteurId = record.user_id as string | undefined;
  const logPrefix = `[forum_messages ${record.id}]`;
  console.log(`${logPrefix} ticket_id=${ticketId} expediteur=${expediteurId}`);
  if (!ticketId || !expediteurId) return sortie(logPrefix, "record incomplet (ticket_id ou user_id manquant)");

  const { data: ticket, error: ticketError } = await supabase
    .from("forum_tickets")
    .select("id, titre, user_id, topic_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketError) throw ticketError;
  console.log(`${logPrefix} ticket chargé=${JSON.stringify(ticket)}`);
  if (!ticket) return sortie(logPrefix, "ticket introuvable");
  if (ticket.topic_id != null) return sortie(logPrefix, `ticket de topic de sens (topic_id=${ticket.topic_id})`);

  const { data: participants, error: participantsError } = await supabase
    .from("forum_messages")
    .select("user_id")
    .eq("ticket_id", ticketId);
  if (participantsError) throw participantsError;

  const ids = new Set<string>([ticket.user_id, ...(participants ?? []).map((p) => p.user_id as string)]);
  console.log(`${logPrefix} auteur + participants (distincts) : ${ids.size}`);
  ids.delete(expediteurId);
  console.log(`${logPrefix} après retrait de l'expéditeur : ${ids.size}`);
  if (ids.size === 0) return sortie(logPrefix, "aucun destinataire hors expéditeur (ex. premier message de l'auteur)");

  const [{ data: profils, error: profilsError }, { data: expediteur }] = await Promise.all([
    supabase
      .from("user_profile")
      .select("id, notifications_actives, push_token")
      .in("id", Array.from(ids)),
    supabase.from("user_profile").select("pseudo").eq("id", expediteurId).maybeSingle(),
  ]);
  if (profilsError) throw profilsError;
  console.log(`${logPrefix} profils trouvés dans user_profile : ${(profils ?? []).length}`);

  const destinataires = filtrerDestinataires((profils ?? []) as ProfilPush[], logPrefix);
  if (destinataires.length === 0) return sortie(logPrefix, "aucun destinataire avec notifications actives et token");

  const pseudo = (expediteur?.pseudo as string | null) || "Quelqu'un";
  const body = `${pseudo} a répondu à «${NBSP}${ticket.titre}${NBSP}»`;
  return await envoyer(destinataires, body, { type: "forum_reply", ticketId }, logPrefix);
}

// Nouvelle question (topic_id null) : tous les admins, sauf l'auteur.
async function surNouveauTicket(record: Record<string, unknown>) {
  const logPrefix = `[forum_tickets ${record.id}]`;
  console.log(`${logPrefix} topic_id=${record.topic_id} sujet=${record.sujet} auteur=${record.user_id}`);
  if (record.topic_id != null) return sortie(logPrefix, `ticket de topic de sens (topic_id=${record.topic_id})`);

  const ticketId = record.id as string;
  const auteurId = record.user_id as string;
  const titre = record.titre as string;
  const sujet = SUJET_LABEL[record.sujet as string];

  const { data: admins, error } = await supabase
    .from("user_profile")
    .select("id, notifications_actives, push_token")
    .eq("role", "admin");
  if (error) throw error;
  console.log(`${logPrefix} comptes role='admin' : ${(admins ?? []).length}`);

  const horsAuteur = ((admins ?? []) as ProfilPush[]).filter((a) => a.id !== auteurId);
  console.log(`${logPrefix} après retrait de l'auteur : ${horsAuteur.length}`);

  const destinataires = filtrerDestinataires(horsAuteur, logPrefix);
  if (destinataires.length === 0) return sortie(logPrefix, "aucun admin avec notifications actives et token");

  const body = sujet
    ? `Nouvelle question (${sujet})${NBSP}: ${titre}`
    : `Nouvelle question${NBSP}: ${titre}`;
  return await envoyer(destinataires, body, { type: "forum_ticket", ticketId }, logPrefix);
}

serve(async (req) => {
  const attendu = Deno.env.get("FORUM_WEBHOOK_SECRET");
  if (!attendu) {
    console.error("[forum-notifications] SORTIE 401 — secret FORUM_WEBHOOK_SECRET non défini");
    return json({ error: "unauthorized" }, 401);
  }
  if (!secretValide(req.headers.get("x-webhook-secret"), attendu)) {
    console.error("[forum-notifications] SORTIE 401 — en-tête x-webhook-secret absent ou invalide");
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    console.log(
      `[forum-notifications] reçu type=${payload.type} schema=${payload.schema} table=${payload.table} record.id=${payload.record?.id}`,
    );
    if (payload.type !== "INSERT") {
      return json(sortie("[forum-notifications]", `événement ${payload.type} non traité`));
    }
    if (!payload.record) return json(sortie("[forum-notifications]", "record absent du payload"));

    let resultat: unknown;
    if (payload.table === "forum_messages") resultat = await surNouveauMessage(payload.record);
    else if (payload.table === "forum_tickets") resultat = await surNouveauTicket(payload.record);
    else resultat = sortie("[forum-notifications]", `table ${payload.table} non traitée`);

    console.log(`[forum-notifications] résultat=${JSON.stringify(resultat)}`);
    return json(resultat);
  } catch (err) {
    console.error("Erreur forum-notifications:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
