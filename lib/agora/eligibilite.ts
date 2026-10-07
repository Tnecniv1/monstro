// Éligibilité d'un élève à l'Agora (génération et envoi des rapports).
// Partagé par la page admin, la Server Action d'envoi manuel et le cron d'envoi automatique.
import type { SupabaseClient } from '@supabase/supabase-js'

// resilie : abonnement Stripe résilié, encore dans sa période payée (abonnement.resiliation_programmee)
// gratuit : aucun accès à l'application (user_profile.plan)
// inconnu : statut illisible en base → coupé par prudence
export type MotifBlocage = 'resilie' | 'gratuit' | 'inconnu'

export const LIBELLES_BLOCAGE: Record<MotifBlocage, string> = {
  resilie: 'Agora désactivé — abonnement résilié',
  gratuit: 'Agora désactivé — aucun accès',
  inconnu: "Agora désactivé — statut d'abonnement illisible",
}

// Mêmes plans que hasAppAccess (lib/access.ts)
const PLANS_AVEC_ACCES = ['abonne', 'essai', 'classe']

/**
 * Charge le statut de tous les élèves et renvoie une fonction `eleveId → motif de blocage` (null = Agora autorisé).
 * `supabase` doit être le client service role, pour lire `abonnement` quelle que soit la RLS.
 * Seuls les élèves explicitement lus avec un plan donnant accès sont autorisés ; lève une erreur
 * si la base est illisible (migration 20261007_agora_resiliation.sql absente, par exemple) :
 * l'appelant doit alors refuser l'envoi.
 */
export async function chargerEligibiliteAgora(
  supabase: SupabaseClient,
): Promise<(eleveId: string) => MotifBlocage | null> {
  const [{ data: profils, error: errProfils }, { data: resilies, error: errResilies }] = await Promise.all([
    supabase.from('user_profile').select('id, plan').in('plan', PLANS_AVEC_ACCES),
    supabase.from('abonnement').select('user_id').eq('resiliation_programmee', true),
  ])
  if (errProfils || errResilies) {
    throw new Error(`statut d'abonnement illisible : ${(errProfils ?? errResilies)?.message}`)
  }

  const planDe = new Map(((profils ?? []) as { id: string; plan: string }[]).map((p) => [p.id, p.plan]))
  const resiliations = new Set(((resilies ?? []) as { user_id: string }[]).map((a) => a.user_id))

  return (eleveId) => {
    const plan = planDe.get(eleveId)
    if (!plan) return 'gratuit'
    // Un accès « classe » ou « essai » ne dépend pas de Stripe : la résiliation ne coupe que les abonnés
    if (plan === 'abonne' && resiliations.has(eleveId)) return 'resilie'
    return null
  }
}
