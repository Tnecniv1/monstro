// Libellés des 20 étapes du parcours élève, dans l'ordre. L'étape N
// correspond à etapes[N-1] dans la RPC get_parcours_admin().
export const ETAPES_PARCOURS: string[] = [
  'Modal numéro 1 lu et accepté',
  'Modal numéro 2 ouvert et validé',
  'Modal numéro 3 ouvert validé',
  'Script 1 ouvert',
  "Au moins une feuille d'entraînement mise en focus",
  'Le premier entraînement ajouté',
  'La première session ajoutée',
  'Le premier entraînement validé',
  ...Array.from({ length: 12 }, (_, i) => `Niveau ${i + 1} gagné`),
]

// Étapes 1 à 8 : bloc « Onboarding » ; 9 à 20 : bloc « Niveaux 1 à 12 ».
export const NB_ETAPES_ONBOARDING = 8

// Valeur de etape_courante une fois les 20 étapes franchies.
export const PARCOURS_TERMINE = 21
