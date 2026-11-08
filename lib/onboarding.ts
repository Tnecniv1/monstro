// Onboarding en 3 étapes (/bienvenue) : Objectif → Positionnement →
// Introduction. Pur TypeScript, sans import : utilisable dans le middleware
// (edge) comme dans la page.
//
// Concerne un élève (rôle etudiant) avec l'accès complet. Il reprend à la
// première étape non faite :
// 1. objectif : pas de ligne parcours_eleve ;
// 2. positionnement : parcours_eleve.positionnement_at null ;
// 3. introduction : user_profile.script1_ouvert_at null.

export const ROUTE_ONBOARDING = '/bienvenue'

export type EtapeOnboarding = 'objectif' | 'positionnement' | 'introduction'

export const ETAPES_ONBOARDING: EtapeOnboarding[] = ['objectif', 'positionnement', 'introduction']

// Même règle que hasAppAccess (lib/access.ts), recopiée pour garder ce
// fichier sans import.
function accesComplet(plan: string | null | undefined): boolean {
  return plan === 'classe' || plan === 'abonne' || plan === 'essai'
}

export function etapeOnboarding(p: {
  role: string | null | undefined
  plan: string | null | undefined
  script1OuvertAt: string | null | undefined
  // null : pas de ligne parcours_eleve.
  assignation: { positionnement_at: string | null } | null
}): EtapeOnboarding | null {
  if (p.role !== 'etudiant' || !accesComplet(p.plan)) return null
  if (!p.assignation) return 'objectif'
  if (!p.assignation.positionnement_at) return 'positionnement'
  if (!p.script1OuvertAt) return 'introduction'
  return null
}

// Relation un-à-un user_profile → parcours_eleve : Supabase renvoie un objet
// ou null (tableau par prudence).
export function premiereAssignation<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel ?? null
}
