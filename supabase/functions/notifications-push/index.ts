import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePushResults, sendExpoPush, type ExpoPushMessage } from "../_shared/expoPush.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const NOTIF_TYPE = "rappel_quotidien";
const MESSAGE_TITLE = "Monstro";
const OBJECTIF_TOTAL = 1000;
const MESSAGE_A = "Tu n'as pas encore pratiqué aujourd'hui — 5 minutes suffisent !";

function messageB(reste: number): string {
  return `Il te reste ${reste} problèmes à résoudre pour en réussir 1000 en tout — on se met au travail ?`;
}

type Candidat = {
  id: string;
  push_token: string;
};

// Heure locale Europe/Paris, gère automatiquement le passage CET/CEST
// (contrairement à un simple offset fixe).
function heureParisActuelle(): number {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

function dateParisAujourdhui(): string {
  // en-CA formate en YYYY-MM-DD, directement comparable à une colonne `date`.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

// Équivalent de extract(doy from now()) : jour de l'année (1-366) à partir
// d'une date YYYY-MM-DD, sans dépendre d'un état stocké.
function jourDeLAnnee(dateISO: string): number {
  const [annee, mois, jour] = dateISO.split("-").map(Number);
  const date = Date.UTC(annee, mois - 1, jour);
  const debutAnnee = Date.UTC(annee, 0, 1);
  return Math.floor((date - debutAnnee) / 86_400_000) + 1;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (_req) => {
  try {
    const heureActuelle = heureParisActuelle();
    const aujourdHui = dateParisAujourdhui();
    // Alternance déterministe A/B selon la parité du jour de l'année —
    // pas besoin de state supplémentaire pour savoir quelle variante envoyer.
    const variante: "A" | "B" = jourDeLAnnee(aujourdHui) % 2 === 0 ? "A" : "B";

    // 1. Candidats bruts : notifications activées + token présent.
    const { data: candidats, error: candidatsError } = await supabase
      .from("user_profile")
      .select("id, push_token")
      .eq("notifications_actives", true)
      .not("push_token", "is", null);

    if (candidatsError) throw candidatsError;

    let envoyes = 0;
    let tokensInvalides = 0;

    for (const [index, user] of ((candidats ?? []) as Candidat[]).entries()) {
      console.log(`[user] début traitement id=${user.id} (${index + 1}/${candidats?.length ?? 0})`);

      try {
        // 2. Heure habituelle de l'utilisateur — ne retenir que ceux dont
        //    l'heure habituelle correspond à l'heure actuelle (Paris).
        const { data: heureHabituelle, error: heureError } = await supabase
          .rpc("heure_habituelle_utilisateur", { p_user_id: user.id });

        console.log(`[user ${user.id}] heureHabituelle=${JSON.stringify(heureHabituelle)} heureError=${heureError ? JSON.stringify(heureError) : "null"} heureActuelle=${heureActuelle}`);

        if (heureError || heureHabituelle == null) {
          console.log(`[user ${user.id}] SKIP — heureError ou heureHabituelle null`);
          continue;
        }
        if (heureHabituelle !== heureActuelle) {
          console.log(`[user ${user.id}] SKIP — heure habituelle (${heureHabituelle}) ≠ heure actuelle (${heureActuelle})`);
          continue;
        }

        // 3. Déjà une session aujourd'hui → pas de rappel.
        const { count: sessionCount, error: sessionError } = await supabase
          .from("session")
          .select("id, entrainement:entrainement_id!inner(user_id)", { count: "exact", head: true })
          .eq("date", aujourdHui)
          .eq("entrainement.user_id", user.id);

        console.log(`[user ${user.id}] sessionCount=${sessionCount} sessionError=${sessionError ? JSON.stringify(sessionError) : "null"}`);

        if (sessionError) {
          console.log(`[user ${user.id}] SKIP — sessionError`);
          continue;
        }
        if ((sessionCount ?? 0) > 0) {
          console.log(`[user ${user.id}] SKIP — session déjà présente aujourd'hui`);
          continue;
        }

        // 4. Déjà notifié aujourd'hui (évite les doublons si le cron tourne
        //    plusieurs fois, ou si l'heure habituelle change en cours de journée).
        const { data: dejaNotifie, error: dejaNotifieError } = await supabase
          .from("notification_log")
          .select("id")
          .eq("user_id", user.id)
          .eq("jour", aujourdHui)
          .eq("type", NOTIF_TYPE)
          .maybeSingle();

        console.log(`[user ${user.id}] dejaNotifie=${JSON.stringify(dejaNotifie)} dejaNotifieError=${dejaNotifieError ? JSON.stringify(dejaNotifieError) : "null"}`);

        if (dejaNotifie) {
          console.log(`[user ${user.id}] SKIP — déjà notifié aujourd'hui`);
          continue;
        }

        // 5. Choix du message. Variante B : personnalisée avec le nombre de
        //    problèmes restants pour atteindre 1000 (même logique que le
        //    PixelGrid : observations en etat succes/corrige pour l'utilisateur).
        //    Si l'objectif est déjà dépassé, on retombe sur la variante A.
        let messageBody = MESSAGE_A;
        console.log(`[user ${user.id}] variante du jour=${variante}`);

        if (variante === "B") {
          const { count: resolus, error: resolusError } = await supabase
            .from("observation")
            .select("id, entrainement:entrainement_id!inner(user_id)", { count: "exact", head: true })
            .in("etat", ["succes", "corrige"])
            .eq("entrainement.user_id", user.id);

          console.log(`[user ${user.id}] resolus=${resolus} resolusError=${resolusError ? JSON.stringify(resolusError) : "null"}`);

          if (!resolusError) {
            const reste = OBJECTIF_TOTAL - (resolus ?? 0);
            console.log(`[user ${user.id}] reste=${reste}`);
            if (reste > 0) messageBody = messageB(reste);
          }
        }

        // 6. Envoi via l'API Expo Push (module partagé, un message par
        //    utilisateur comme avant). Le nettoyage DeviceNotRegistered est
        //    fait par handlePushResults.
        const pushPayload: ExpoPushMessage = {
          to: user.push_token,
          title: MESSAGE_TITLE,
          body: messageBody,
          sound: "default",
        };
        const [result] = await sendExpoPush([pushPayload], `[user ${user.id}]`);
        const [outcome] = await handlePushResults(supabase, [{ userId: user.id, result }], `[user ${user.id}]`);

        if (outcome.statut === "device_not_registered") {
          tokensInvalides++;
          console.log(`[user ${user.id}] SKIP — DeviceNotRegistered, token retiré`);
          continue;
        }
        // Comportement d'origine conservé : seule une requête sans réponse
        // exploitable ou un ticket en erreur interrompt ; une réponse JSON
        // sans ticket ("sans_ticket") est journalisée comme un envoi réussi.
        if (outcome.statut === "erreur" || outcome.statut === "echec_requete") {
          continue;
        }

        // 7. Journalisation après envoi réussi uniquement.
        await supabase.from("notification_log").insert({
          user_id: user.id,
          jour: aujourdHui,
          type: NOTIF_TYPE,
        });
        envoyes++;
        console.log(`[user ${user.id}] envoyé avec succès`);
      } catch (userErr) {
        console.error(`[user ${user.id}] EXCEPTION non gérée dans le traitement:`, (userErr as Error)?.message ?? userErr, (userErr as Error)?.stack);
        continue;
      }
    }

    return json({
      heure: heureActuelle,
      candidats: candidats?.length ?? 0,
      envoyes,
      tokensInvalides,
    });
  } catch (err) {
    console.error("Erreur notifications-push:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
