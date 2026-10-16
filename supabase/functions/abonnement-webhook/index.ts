import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Jetons ADN crédités à chaque facture d'abonnement payée
const JETONS_PAR_FACTURE = 12;

// Hiérarchie de force des statuts : un statut fort ne doit jamais être
// écrasé par un statut plus faible pour le MÊME abonnement.
const RANG_STATUT: Record<string, number> = {
  canceled: 0,
  incomplete_expired: 0,
  unpaid: 0,
  incomplete: 1,
  past_due: 2,
  paused: 2,
  trialing: 3,
  active: 3,
};

function rang(statut: string): number {
  return RANG_STATUT[statut] ?? 1; // défaut prudent : niveau "incomplete"
}

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text(); // corps brut, obligatoire pour vérifier la signature

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(`Signature invalide: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const eventTime = new Date(event.created * 1000).toISOString();

        // Retrouver l'user_id via les metadata du Customer (posées au checkout)
        const customer = await stripe.customers.retrieve(sub.customer as string);
        const userId = (customer as Stripe.Customer).metadata?.user_id;
        if (!userId) throw new Error("user_id absent des metadata du customer");

        const periodEnd =
          (sub as any).current_period_end ??
          (sub as any).items?.data?.[0]?.current_period_end ??
          null;

        // Anti-course par hiérarchie de statuts (et non par timestamp).
        const { data: existing } = await supabase
          .from("abonnement")
          .select("statut, stripe_subscription_id")
          .eq("user_id", userId)
          .maybeSingle();

        // On ignore un nouvel événement UNIQUEMENT si :
        //  - il concerne le même abonnement que celui déjà en base, ET
        //  - son statut est STRICTEMENT plus faible que celui déjà enregistré, ET
        //  - ce n'est pas un événement de suppression explicite.
        const memeAbonnement = existing?.stripe_subscription_id === sub.id;
        const estSuppression = event.type === "customer.subscription.deleted";

        if (
          existing &&
          memeAbonnement &&
          !estSuppression &&
          rang(sub.status) < rang(existing.statut)
        ) {
          // Événement périmé / plus faible → on n'écrase pas.
          break;
        }

        // Écriture ATOMIQUE (abonnement + user_profile.plan) dans une seule
        // transaction SQL. 'classe' est protégé côté fonction.
        const { error: syncError } = await supabase.rpc("sync_abonnement", {
          p_user_id: userId,
          p_customer_id: sub.customer as string,
          p_subscription_id: sub.id,
          p_price_id: sub.items.data[0]?.price.id ?? null,
          p_statut: sub.status,
          p_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
          p_event_time: eventTime,
        });

        // CRUCIAL : si l'écriture échoue, on lève une erreur → réponse 500
        // → Stripe réessaiera l'événement automatiquement (pas d'échec silencieux).
        if (syncError) {
          throw new Error(`sync_abonnement a échoué: ${syncError.message}`);
        }

        // Résiliation programmée : abonnement encore « active » jusqu'à la fin de la
        // période payée mais qui ne se renouvellera pas → coupe l'Agora (lib/agora/eligibilite.ts).
        // L'état est relu chez Stripe plutôt que pris dans l'événement : les événements
        // peuvent arriver dans le désordre, et ce drapeau n'a pas de hiérarchie de statuts.
        const frais = await stripe.subscriptions.retrieve(sub.id);
        const resiliationProgrammee =
          frais.status !== "canceled" &&
          (frais.cancel_at_period_end || frais.cancel_at != null);

        const { error: resiliationError } = await supabase
          .from("abonnement")
          .update({ resiliation_programmee: resiliationProgrammee })
          .eq("user_id", userId)
          .eq("stripe_subscription_id", sub.id);

        if (resiliationError) {
          throw new Error(`resiliation_programmee non enregistrée: ${resiliationError.message}`);
        }

        break;
      }
      // Jetons ADN : chaque facture d'abonnement payée crédite l'élève
      // (supabase/migrations/20261013_tokens_adn.sql).
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        // Factures d'abonnement uniquement. Le champ a changé de place selon la
        // version d'API de l'événement (subscription, puis parent.subscription_details).
        const subscriptionId =
          (invoice as any).subscription ??
          (invoice as any).parent?.subscription_details?.subscription ??
          null;
        // Une facture à 0 € (essai, remise totale) est aussi « payée » : pas de jeton.
        if (!subscriptionId || (invoice.amount_paid ?? 0) <= 0) break;

        const customer = await stripe.customers.retrieve(invoice.customer as string);
        const userId = (customer as Stripe.Customer).metadata?.user_id;
        if (!userId) throw new Error("user_id absent des metadata du customer");

        // Idempotent : la facture sert de référence, un événement rejoué par Stripe
        // ne crédite pas deux fois. Le plafond de 15 est appliqué par la fonction SQL.
        const { error: tokenError } = await supabase.rpc("token_appliquer", {
          p_user_id: userId,
          p_delta: JETONS_PAR_FACTURE,
          p_motif: "abonnement",
          p_reference: invoice.id,
        });

        // Échec → 500 → Stripe réessaiera l'événement.
        if (tokenError) {
          throw new Error(`token_appliquer a échoué: ${tokenError.message}`);
        }

        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erreur webhook:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
    });
  }
});