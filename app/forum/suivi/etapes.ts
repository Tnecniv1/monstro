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

// Pixels cumulés à atteindre pour gagner les niveaux 1 à 12 (étapes 9 à 20).
// Mêmes seuils que dans la RPC get_parcours_admin().
export const SEUILS_NIVEAUX = [50, 150, 300, 500, 800, 1200, 2000, 3000, 4500, 6000, 8000, 10000]

// Données d'un élève dont dépendent les 20 étapes.
export type DonneesParcours = {
  parcours_debut_at: string | null
  // Compte antérieur à l'onboarding : les étapes 1 à 4 sont réputées faites.
  parcours_legacy: boolean
  charte_acceptee_at: string | null
  invitation_script1_vue_at: string | null
  script1_ouvert_at: string | null
  premier_focus_at: string | null
  a_entrainement: boolean
  a_session: boolean
  a_entrainement_termine: boolean
  pixels: number
}

// Les 20 étapes d'un élève, chacune évaluée indépendamment des autres à
// partir de ses propres données : faites[N-1] vaut true si l'étape N est faite.
export function etapesFaites(d: DonneesParcours): boolean[] {
  const legacy = d.parcours_legacy && d.parcours_debut_at != null
  const script1 = d.script1_ouvert_at != null || legacy
  return [
    d.charte_acceptee_at != null || legacy,
    d.invitation_script1_vue_at != null || script1,
    script1,
    script1,
    d.premier_focus_at != null,
    d.a_entrainement,
    d.a_session,
    d.a_entrainement_termine,
    ...SEUILS_NIVEAUX.map((seuil) => d.pixels >= seuil),
  ]
}

// Étape courante = première étape non faite (1 à 20), ou PARCOURS_TERMINE.
export function etapeCourante(faites: boolean[]): number {
  const i = faites.indexOf(false)
  return i === -1 ? PARCOURS_TERMINE : i + 1
}
