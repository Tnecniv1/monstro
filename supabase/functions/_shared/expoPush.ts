import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Envoi via l'API push d'Expo, partagé par notifications-push (rappels
// d'entraînement) et forum-notifications (réponses et nouvelles questions).

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Limite de l'API Expo : 100 messages par requête.
const TAILLE_LOT = 100;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  data?: Record<string, unknown>;
};

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message?: string; details?: { error?: string } };

// Un résultat par message envoyé, dans le même ordre. reponseRecue = false si
// la requête a échoué (exception réseau, réponse non JSON) ; ticket = null si
// aucun ticket n'a été reçu pour ce message.
export type PushResult = {
  message: ExpoPushMessage;
  reponseRecue: boolean;
  ticket: ExpoPushTicket | null;
};

function tronquerToken(token: string): string {
  return `${token.slice(0, 12)}…${token.slice(-6)}`;
}

export async function sendExpoPush(
  messages: ExpoPushMessage[],
  logPrefix = "[push]",
): Promise<PushResult[]> {
  const results: PushResult[] = [];

  for (let i = 0; i < messages.length; i += TAILLE_LOT) {
    const lot = messages.slice(i, i + TAILLE_LOT);
    console.log(
      `${logPrefix} avant appel Expo — ${lot.length} message(s), tokens=${lot.map((m) => tronquerToken(m.to)).join(", ")} payload=${JSON.stringify(lot.map(({ to: _to, ...reste }) => reste))}`,
    );

    let reponseRecue = false;
    let tickets: unknown[] | null = null;
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(lot),
      });
      const texte = await response.text();
      console.log(`${logPrefix} réponse Expo — status=${response.status} body=${texte}`);
      try {
        const parsed = JSON.parse(texte);
        reponseRecue = true;
        tickets = Array.isArray(parsed?.data) ? parsed.data : parsed?.data ? [parsed.data] : null;
      } catch (parseErr) {
        console.error(
          `${logPrefix} réponse Expo non-JSON (status=${response.status}):`,
          (parseErr as Error)?.message ?? parseErr,
        );
      }
    } catch (fetchErr) {
      console.error(
        `${logPrefix} EXCEPTION fetch Expo:`,
        (fetchErr as Error)?.message ?? fetchErr,
        (fetchErr as Error)?.stack,
      );
    }

    lot.forEach((message, j) => {
      results.push({ message, reponseRecue, ticket: (tickets?.[j] as ExpoPushTicket | undefined) ?? null });
    });
  }

  return results;
}

// echec_requete : pas de réponse exploitable d'Expo. sans_ticket : réponse
// JSON reçue mais sans ticket pour ce message (ex. erreur sur toute la requête).
export type PushOutcome = {
  userId: string;
  statut: "ok" | "device_not_registered" | "erreur" | "echec_requete" | "sans_ticket";
  ticket: ExpoPushTicket | null;
};

// Nettoyage des tokens morts : un ticket DeviceNotRegistered (désinstallation,
// etc.) retire le token et désactive les notifications de l'utilisateur, pour
// ne plus jamais réessayer dessus. Les autres erreurs sont seulement journalisées.
export async function handlePushResults(
  supabase: SupabaseClient,
  envois: { userId: string; result: PushResult }[],
  logPrefix = "[push]",
): Promise<PushOutcome[]> {
  const outcomes: PushOutcome[] = [];

  for (const { userId, result } of envois) {
    const ticket = result.ticket;
    console.log(`${logPrefix} [user ${userId}] ticket=${JSON.stringify(ticket)}`);

    if (!result.reponseRecue) {
      outcomes.push({ userId, statut: "echec_requete", ticket });
      continue;
    }
    if (!ticket) {
      outcomes.push({ userId, statut: "sans_ticket", ticket });
      continue;
    }

    if (ticket.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") {
        await supabase
          .from("user_profile")
          .update({ push_token: null, notifications_actives: false })
          .eq("id", userId);
        console.log(`${logPrefix} [user ${userId}] DeviceNotRegistered, token retiré`);
        outcomes.push({ userId, statut: "device_not_registered", ticket });
      } else {
        console.error(
          `${logPrefix} [user ${userId}] erreur push (autre que DeviceNotRegistered):`,
          JSON.stringify(ticket),
        );
        outcomes.push({ userId, statut: "erreur", ticket });
      }
      continue;
    }

    outcomes.push({ userId, statut: "ok", ticket });
  }

  return outcomes;
}
