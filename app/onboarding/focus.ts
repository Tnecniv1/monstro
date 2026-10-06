import type { createClient } from '@/lib/supabase/client'
import { hasAppAccess } from '@/lib/access'

// Étape Focus de l'onboarding, entre la charte et l'invitation au Script 1 :
// l'élève doit avoir en Focus au moins une feuille de chacune de ces deux
// racines de l'arbre des feuilles (noeud.nom, parent_id nul). Renommer une
// racine en base demande de changer la constante ici.
export const RACINE_CHAOTIQUE = 'Problèmes Chaotiques'
export const RACINE_MECANIQUE = 'Exercices Mécaniques'

// Émis par la Bibliothèque après chaque mise en Focus ou retrait, pour que
// OnboardingGate (monté dans le layout, état séparé) relise les Focus.
export const FOCUS_CHANGE_EVENT = 'onboarding:focus-change'

export type CategoriesFocus = { chaotique: boolean; mecanique: boolean }

// Catégories couvertes, à partir de la racine de chaque feuille en Focus.
export function categoriesEnFocus(racines: (string | null | undefined)[]): CategoriesFocus {
  return {
    chaotique: racines.includes(RACINE_CHAOTIQUE),
    mecanique: racines.includes(RACINE_MECANIQUE),
  }
}

export function etapeFocusValidee(c: CategoriesFocus): boolean {
  return c.chaotique && c.mecanique
}

// L'étape ne concerne que les élèves en cours d'onboarding : charte acceptée,
// Script 1 pas encore ouvert. Mêmes exclusions qu'OnboardingGate (admin, sans
// abonnement actif). Elle est acquise une fois focus_valide_at posé, quoi que
// deviennent les Focus ensuite.
export function estEnEtapeFocus(
  profile: {
    role: string | null
    plan: string | null
    charte_acceptee_at: string | null
    script1_ouvert_at: string | null
    focus_valide_at: string | null
  } | null
): boolean {
  if (!profile || profile.role === 'admin' || !hasAppAccess(profile.role, profile.plan)) return false
  return profile.charte_acceptee_at != null && profile.script1_ouvert_at == null && profile.focus_valide_at == null
}

// Âge en années révolues aujourd'hui (heure de Paris), à partir d'une date
// 'YYYY-MM-DD'. null si la date est absente ou illisible.
export function ageAujourdhui(dateNaissance: string | null): number | null {
  const naissance = dateNaissance?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!naissance) return null
  const [annee, mois, jour] = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    .split('-')
    .map(Number)
  const anniversairePasse = mois > Number(naissance[2]) || (mois === Number(naissance[2]) && jour >= Number(naissance[3]))
  return annee - Number(naissance[1]) - (anniversairePasse ? 0 : 1)
}

type ChaineNoeud = {
  nom: string
  parent: { nom: string; grandparent: { nom: string } | null } | null
} | null

// Racine d'une feuille : le nœud le plus haut de la chaîne (3 niveaux au plus).
function racine(noeud: ChaineNoeud): string | null {
  return noeud?.parent?.grandparent?.nom ?? noeud?.parent?.nom ?? noeud?.nom ?? null
}

// Lit les feuilles en Focus de l'élève et renvoie les catégories couvertes.
// null si la lecture échoue : on ne conclut rien.
export async function chargerCategoriesEnFocus(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<CategoriesFocus | null> {
  const { data, error } = await supabase
    .from('feuille_focus')
    .select(
      'feuille:feuille_entrainement ( noeud:noeud_id ( nom, parent:parent_id ( nom, grandparent:parent_id ( nom ) ) ) )'
    )
    .eq('user_id', userId)
  if (error) {
    console.error('[onboarding] échec de la lecture des feuilles en Focus', error)
    return null
  }
  const lignes = (data ?? []) as unknown as { feuille: { noeud: ChaineNoeud } | null }[]
  return categoriesEnFocus(lignes.map((l) => racine(l.feuille?.noeud ?? null)))
}
