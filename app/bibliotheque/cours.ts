// Cours — table forum_resources (anciennement l'onglet Ressources du Forum),
// affichés dans la vue « Cours » de la Bibliothèque. categorie : contrainte
// forum_resources_categorie_check en base.
export type CategorieCours = 'introduction' | 'exploration'

export const CATEGORIES_COURS: readonly CategorieCours[] = ['introduction', 'exploration']

export const CATEGORIE_COURS_LABEL: Record<CategorieCours, string> = {
  introduction: 'Introduction',
  exploration: 'Exploration',
}

export type Cours = {
  id: string
  titre: string
  description: string | null
  pdf_url: string | null
  categorie: CategorieCours
}

export type VueBibliotheque = 'problemes' | 'cours'

export function estCategorieCours(valeur: unknown): valeur is CategorieCours {
  return CATEGORIES_COURS.includes(valeur as CategorieCours)
}

// /bibliotheque avec sa vue (Problèmes par défaut, omise) et, en vue Cours,
// la catégorie active.
export function bibliothequeHref(vue: VueBibliotheque, categorie: CategorieCours | null): string {
  if (vue === 'problemes') return '/bibliotheque'
  return categorie ? `/bibliotheque?vue=cours&categorie=${categorie}` : '/bibliotheque?vue=cours'
}
