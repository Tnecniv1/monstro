// Feuilles chaotiques d'un parcours (table parcours_accompagnement) : des
// feuilles rattachées au parcours SANS être des étapes, dont un problème
// devient de temps en temps la prochaine action, selon un rythme
// (« 1 problème sur N »). Fonctions pures, sans Supabase ni React : fichier
// copiable tel quel sur mobile, avec progression.ts.
//
// Règles :
// - Plage d'une feuille chaotique : exo_debut ?? 1 à exo_fin ?? volume.
//   Prochain problème = premier exercice NON FAIT de la plage (fait : une
//   observation succes, echec ou corrige, quelle que soit la date). Une
//   feuille entièrement faite n'est plus proposée.
// - Compteurs depuis l'assignation (date de création de l'entraînement
//   postérieure ou égale à parcours_eleve.created_at, lues avec lireDate) :
//   P = exercices distincts faits sur les feuilles des étapes de l'élève
//   (dans leur plage ; étapes après la règle B, acquises par le test
//   comprises) ; A(f) = exercices distincts faits sur la feuille chaotique f
//   (dans sa plage).
// - f a son tour si (A(f) + 1) × (rythme − 1) ≤ P : rythme 5 donne
//   pppp C pppp C… (premier chaotique après 4 exercices du parcours),
//   rythme 2 donne p C p C…
// - Prochaine action, dans l'ordre : activité en cours → REPRENDRE ; parcours
//   terminé → « Parcours terminé » ; première feuille chaotique (par ordre)
//   qui a son tour et un problème non fait → ce problème ; sinon la prochaine
//   action du parcours.
// - Les feuilles chaotiques n'entrent dans aucun calcul de progression
//   (étape en cours, stations, acquis par le test).
//
// Exemples (une feuille chaotique C, rythme 5 donc rythme − 1 = 4, problèmes 1
// à 10) :
// 1. P = 3, A(C) = 0 : (0 + 1) × 4 = 4 > 3 → action du parcours.
// 2. P = 4, A(C) = 0 : 4 ≤ 4 → C a son tour → prochaine action = premier
//    problème non fait de C (source 'chaotique').
// 3. P = 4, A(C) = 1 : (1 + 1) × 4 = 8 > 4 → action du parcours.
// 4. P = 8, A(C) = 1 : 8 ≤ 8 → C a son tour.
// 5. C entièrement faite (ses 10 problèmes) : prochainProbleme → null, C
//    n'est plus proposée même si elle a son tour → action du parcours.

import { cleExercice, lireDate, plageEtape, type EtapeProgression, type EtatsExercices, type Progression } from './progression'

export type FeuilleChaotique = {
  // parcours_accompagnement.id
  id: string
  feuille_id: string
  rythme: number
  exo_debut: number | null
  exo_fin: number | null
  // Nombre d'exercices de la feuille (feuille_entrainement.volume).
  volume: number | null
  ordre: number
}

// Un entraînement « fait » (observation succes, echec ou corrige) et la date
// de création de l'entraînement (ISO, telle que renvoyée par Supabase).
export type FaitDate = { feuille_id: string; ref_exo: number; date: string | null }

export type ActionChoisie =
  | { type: 'en_cours' }
  | { type: 'termine' }
  | {
      type: 'commencer'
      source: 'parcours' | 'chaotique'
      feuilleId: string
      exo: number
      // Feuille chaotique choisie (source 'chaotique').
      accompagnementId?: string
    }
  | null

function plage(f: { feuille_id: string | null; exo_debut: number | null; exo_fin: number | null; volume: number | null }) {
  return plageEtape(f as EtapeProgression)
}

// Premier exercice non fait de la plage ; null si tout est fait (ou plage vide).
export function prochainProbleme(f: FeuilleChaotique, exercices: EtatsExercices): number | null {
  const { debut, fin } = plage(f)
  for (let n = debut; n <= fin; n++) {
    if (!exercices.faits.has(cleExercice(f.feuille_id, n))) return n
  }
  return null
}

// Problèmes faits dans la plage, toutes dates (page Parcours).
export function faitsSurPlage(f: FeuilleChaotique, exercices: EtatsExercices): number {
  const { debut, fin } = plage(f)
  let n = 0
  for (let i = debut; i <= fin; i++) if (exercices.faits.has(cleExercice(f.feuille_id, i))) n++
  return n
}

// P et A(f), exercices distincts faits depuis l'assignation, dans les
// plages. Une date illisible n'est pas comptée.
export function compteurs(
  etapes: EtapeProgression[],
  chaotiques: FeuilleChaotique[],
  faitsDates: FaitDate[],
  assigneLe: string
): { P: number; A: Record<string, number> } {
  const depuis = lireDate(assigneLe)
  const faitsDepuis = new Set<string>()
  if (!isNaN(depuis)) {
    for (const f of faitsDates) {
      const t = lireDate(f.date)
      if (!isNaN(t) && t >= depuis) faitsDepuis.add(cleExercice(f.feuille_id, f.ref_exo))
    }
  }

  const duParcours = new Set<string>()
  for (const e of etapes) {
    if (!e.feuille_id) continue
    const { debut, fin } = plageEtape(e)
    for (let n = debut; n <= fin; n++) {
      const cle = cleExercice(e.feuille_id, n)
      if (faitsDepuis.has(cle)) duParcours.add(cle)
    }
  }

  const A: Record<string, number> = {}
  for (const c of chaotiques) {
    const { debut, fin } = plage(c)
    let n = 0
    for (let i = debut; i <= fin; i++) if (faitsDepuis.has(cleExercice(c.feuille_id, i))) n++
    A[c.id] = n
  }
  return { P: duParcours.size, A }
}

// (A + 1) × (rythme − 1) ≤ P
export function aSonTour(A: number, rythme: number, P: number): boolean {
  return (A + 1) * (rythme - 1) <= P
}

export function choisirProchaineAction(p: {
  etapes: EtapeProgression[]
  progression: Progression
  chaotiques: FeuilleChaotique[]
  exercices: EtatsExercices
  faitsDates: FaitDate[]
  assigneLe: string
  // Entraînement (ou correction) en cours.
  activiteEnCours: boolean
}): ActionChoisie {
  if (p.activiteEnCours) return { type: 'en_cours' }
  if (p.progression.termine) return { type: 'termine' }

  if (p.chaotiques.length > 0) {
    const { P, A } = compteurs(p.etapes, p.chaotiques, p.faitsDates, p.assigneLe)
    const triees = p.chaotiques.slice().sort((a, b) => a.ordre - b.ordre)
    for (const c of triees) {
      if (!aSonTour(A[c.id] ?? 0, c.rythme, P)) continue
      const exo = prochainProbleme(c, p.exercices)
      if (exo !== null) return { type: 'commencer', source: 'chaotique', feuilleId: c.feuille_id, exo, accompagnementId: c.id }
    }
  }

  const i = p.progression.etapeCouranteIndex
  const etape = i !== null ? p.etapes[i] : null
  if (etape?.feuille_id && p.progression.prochainExo !== null) {
    return { type: 'commencer', source: 'parcours', feuilleId: etape.feuille_id, exo: p.progression.prochainExo }
  }
  return null
}
