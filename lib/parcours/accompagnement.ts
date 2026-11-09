// Feuilles chaotiques d'un parcours (table parcours_accompagnement) : des
// feuilles rattachées au parcours SANS être des étapes, dont un problème
// devient de temps en temps la prochaine action, selon un rythme
// (« 1 problème sur N »). Fonctions pures, sans Supabase ni React : fichier
// copiable tel quel sur mobile, avec progression.ts.
//
// Exemple (pas de rattrapage) : élève assigné depuis longtemps, 40 exercices
// du parcours faits ; Exeter ajouté aujourd'hui au parcours, « 1 problème
// sur 5 ». Les compteurs d'Exeter partent d'aujourd'hui : P = 0, A = 0,
// (0 + 1) × 4 = 4 > 0 → action du parcours (et non 10 problèmes Exeter
// d'affilée pour « rattraper » les 40 exercices). Après 4 exercices du
// parcours, P = 4 → Exeter a son tour.
//
// Règles :
// - Plage d'une feuille chaotique : exo_debut ?? 1 à exo_fin ?? volume.
//   Prochain problème = premier exercice NON FAIT de la plage (fait : une
//   observation succes, echec ou corrige, quelle que soit la date). Une
//   feuille entièrement faite n'est plus proposée.
// - Compteurs propres à chaque feuille chaotique f, depuis debut(f) = la
//   plus récente de deux dates : assignation de l'élève
//   (parcours_eleve.created_at) et ajout de f au parcours
//   (parcours_accompagnement.created_at). Un entraînement compte si sa date
//   de création est postérieure ou égale à debut(f) (dates lues avec
//   lireDate ; date d'ajout illisible ou absente : l'assignation seule).
//   P(f) = exercices distincts faits sur les feuilles des étapes de l'élève
//   (dans leur plage ; étapes après la règle B, acquises par le test
//   comprises) depuis debut(f) ; A(f) = exercices distincts faits sur f
//   (dans sa plage) depuis debut(f).
// - f a son tour si (A(f) + 1) × (rythme − 1) ≤ P(f) : rythme 5 donne
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
// à 10 ; P et A comptés depuis debut(C)) :
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
  // parcours_accompagnement.created_at : date d'ajout au parcours (ISO).
  ajouteeLe: string | null
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

// debut(f) : la plus récente des dates d'assignation et d'ajout de f au
// parcours (NaN si l'assignation est illisible : rien n'est compté).
export function debutCompteurs(f: FeuilleChaotique, assigneLe: string): number {
  const assignation = lireDate(assigneLe)
  const ajout = lireDate(f.ajouteeLe)
  return isNaN(ajout) ? assignation : Math.max(assignation, ajout)
}

// P(f) et A(f) pour chaque feuille chaotique (par id), exercices distincts
// faits depuis debut(f), dans les plages. Une date illisible n'est pas comptée.
export function compteurs(
  etapes: EtapeProgression[],
  chaotiques: FeuilleChaotique[],
  faitsDates: FaitDate[],
  assigneLe: string
): { P: Record<string, number>; A: Record<string, number> } {
  const P: Record<string, number> = {}
  const A: Record<string, number> = {}
  for (const c of chaotiques) {
    const depuis = debutCompteurs(c, assigneLe)
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
    P[c.id] = duParcours.size

    const { debut, fin } = plage(c)
    let n = 0
    for (let i = debut; i <= fin; i++) if (faitsDepuis.has(cleExercice(c.feuille_id, i))) n++
    A[c.id] = n
  }
  return { P, A }
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
      if (!aSonTour(A[c.id] ?? 0, c.rythme, P[c.id] ?? 0)) continue
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
