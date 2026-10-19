// Libellés des 20 étapes du parcours élève, dans l'ordre. L'étape N
// correspond à etapes[N-1] dans la RPC get_parcours_admin().
export const ETAPES_PARCOURS: string[] = [
  'Modal numéro 1 lu et accepté',
  'Une feuille « Problèmes Chaotiques » et une feuille « Exercices Mécaniques » mises en focus',
  'Modal numéro 2 ouvert et validé',
  'Modal numéro 3 ouvert validé',
  'Script 1 ouvert',
  'Le premier entraînement ajouté',
  'La première session ajoutée',
  'Le premier entraînement validé',
  ...Array.from({ length: 12 }, (_, i) => `Niveau ${i + 1} gagné`),
]

// Libellés courts, même ordre : en-têtes de colonnes de la matrice du suivi.
export const ETAPES_PARCOURS_COURTES: string[] = [
  'Charte',
  'Focus',
  'Modal 2',
  'Modal 3',
  'Script 1',
  '1er entraînement',
  '1re session',
  '1er terminé',
  ...Array.from({ length: 12 }, (_, i) => `Niveau ${i + 1}`),
]

// Groupes de colonnes, dans l'ordre : nb étapes consécutives chacun (5 + 3 + 12 = 20).
export const GROUPES_ETAPES: { libelle: string; nb: number }[] = [
  { libelle: 'Onboarding', nb: 5 },
  { libelle: 'Démarrage', nb: 3 },
  { libelle: 'Niveaux', nb: 12 },
]

// Valeur de etape_courante une fois les 20 étapes franchies.
export const PARCOURS_TERMINE = 21

// Les 20 étapes d'un élève : faites[N-1] vaut true si l'étape N est faite.
// La RPC date chaque étape indépendamment des autres (une étape manquante ne
// vide pas les suivantes) : une étape est faite dès qu'elle a une date.
export function etapesFaites(etapes: (string | null)[] | null): boolean[] {
  return ETAPES_PARCOURS.map((_, i) => etapes?.[i] != null)
}

// Étape courante = première étape non faite (1 à 20), ou PARCOURS_TERMINE.
export function etapeCourante(faites: boolean[]): number {
  const i = faites.indexOf(false)
  return i === -1 ? PARCOURS_TERMINE : i + 1
}
