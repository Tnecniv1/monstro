import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Rattrapage ponctuel de abonnement.resiliation_programmee pour les abonnements créés
// avant que abonnement-webhook ne renseigne cette colonne. Relit chaque abonnement chez
// Stripe (lecture seule côté Stripe) et n'écrit que cette colonne. Idempotent.
// Réservé au service role : l'appelant doit présenter un JWT de rôle service_role.
// ?dry=1 : calcule sans rien écrire.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// La signature du JWT est déjà vérifiée par la passerelle Supabase (verify_jwt actif :
// ne pas déployer avec --no-verify-jwt) ; on exige ici le rôle service_role.
function estServiceRole(req: Request): boolean {
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (jeton === serviceRoleKey) return true;
  try {
    const charge = jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(charge)).role === "service_role";
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (!estServiceRole(req)) return json({ erreur: "Non autorisé" }, 401);
  const simulation = new URL(req.url).searchParams.get("dry") === "1";

  const { data: abonnements, error } = await supabase
    .from("abonnement")
    .select("id, user_id, statut, stripe_subscription_id, resiliation_programmee")
    .not("stripe_subscription_id", "is", null);
  if (error) return json({ erreur: error.message }, 500);

  const resultats: Record<string, unknown>[] = [];
  for (const abo of abonnements ?? []) {
    try {
      const sub = await stripe.subscriptions.retrieve(abo.stripe_subscription_id);
      const resiliationProgrammee =
        sub.status !== "canceled" &&
        (sub.cancel_at_period_end || sub.cancel_at != null);

      if (!simulation && resiliationProgrammee !== abo.resiliation_programmee) {
        const { error: errMaj } = await supabase
          .from("abonnement")
          .update({ resiliation_programmee: resiliationProgrammee })
          .eq("id", abo.id);
        if (errMaj) throw new Error(errMaj.message);
      }

      resultats.push({
        user_id: abo.user_id,
        statut_base: abo.statut,
        statut_stripe: sub.status,
        avant: abo.resiliation_programmee,
        resiliation_programmee: resiliationProgrammee,
        fin: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      });
    } catch (e) {
      resultats.push({ user_id: abo.user_id, erreur: String((e as Error)?.message ?? e) });
    }
  }

  return json({
    simulation,
    total: resultats.length,
    resilies: resultats.filter((r) => r.resiliation_programmee === true).length,
    modifies: resultats.filter((r) => !r.erreur && r.avant !== r.resiliation_programmee).length,
    erreurs: resultats.filter((r) => r.erreur).length,
    resultats,
  });
});
