// Types et libellés partagés par l'onglet admin « Objectifs » (tables
// parcours, parcours_etape, parcours_eleve). « ParcoursObjectif » évite la
// confusion avec le parcours d'onboarding (app/forum/suivi).

import type { FeuilleRow } from './corrections/CorrectionsClient'

export type Parcours = {
  id: string
  nom: string
  description: string | null
  ordre: number | null
  actif: boolean
  created_at: string
}

export type Etape = {
  id: string
  parcours_id: string
  ordre: number
  type: 'feuille' | 'examen'
  feuille_id: string | null
  exo_debut: number | null
  exo_fin: number | null
  libelle: string | null
  // Set de questions du test de positionnement (qcm_set d'une feuille de
  // l'étape) ; null : aucune question, le test s'arrête à cette étape.
  qcm_set_id: string | null
}

export type Assignation = {
  user_id: string
  parcours_id: string
  date_objectif: string | null
  // Test de positionnement : étape de départ (null : début) et date du test
  // (null : test non passé).
  etape_depart_id: string | null
  positionnement_at: string | null
  // Date d'assignation : sert à repérer les étapes ajoutées après coup.
  created_at: string
}

// Feuille chaotique d'un parcours (table parcours_accompagnement) : rattachée
// sans être une étape ; « 1 problème sur rythme » (lib/parcours/accompagnement.ts).
export type Accompagnement = {
  id: string
  parcours_id: string
  feuille_id: string
  rythme: number
  exo_debut: number | null
  exo_fin: number | null
  ordre: number
}

// Nœud racine « Problèmes Chaotiques » : filtre par défaut du choix d'une
// feuille chaotique.
export const NOEUD_PROBLEMES_CHAOTIQUES = 'a84a33fd-3e17-4a97-ab1f-e7a87757ea64'

// Set de questions du test de positionnement (table qcm_set) : appartient à
// une feuille ; chaque étape feuille d'un objectif choisit un set de sa
// feuille (parcours_etape.qcm_set_id). Nom unique sur une feuille.
export type QcmSet = {
  id: string
  feuille_id: string
  nom: string
  created_at: string
}

export const COLONNES_QCM_SET = 'id, feuille_id, nom, created_at'

// Question du test de positionnement (table qcm_positionnement), rangée dans
// un set ; feuille_id = la feuille du set.
export type QcmPositionnement = {
  id: string
  set_id: string
  feuille_id: string
  chapitre: string | null
  ordre: number
  enonce: string
  choix: { id: string; texte: string }[]
  reponses_correctes: string[]
  image_url: string | null
  actif: boolean
}

export const COLONNES_QCM_POSITIONNEMENT = 'id, set_id, feuille_id, chapitre, ordre, enonce, choix, reponses_correctes, image_url, actif'

// Élève tel que chargé par admin/page.tsx pour l'onglet Objectifs.
export type EleveParcours = {
  id: string
  pseudo: string | null
  prenom: string | null
  nom: string | null
}

export type FeuilleChoix = FeuilleRow

// Nœud racine « Préparation Examen » (sous-nœuds Type bac, Type brevet) :
// seules ses feuilles peuvent servir d'étape examen.
export const NOEUD_PREPARATION_EXAMEN = '6ea71c8e-a819-4e15-9368-bd4033369ea0'

// Vrai si le nœud est la racine donnée ou l'un de ses descendants
// (remontée par parent_id).
export function descendDe(
  noeudId: string | null | undefined,
  racineId: string,
  parentParId: Map<string, string | null>
): boolean {
  const vus = new Set<string>()
  let courant = noeudId ?? null
  while (courant && !vus.has(courant)) {
    if (courant === racineId) return true
    vus.add(courant)
    courant = parentParId.get(courant) ?? null
  }
  return false
}

export function cheminFeuille(f: FeuilleChoix): string {
  const n = f.noeud
  const parts: string[] = []
  if (n?.parent?.grandparent?.nom) parts.push(n.parent.grandparent.nom)
  if (n?.parent?.nom) parts.push(n.parent.nom)
  if (n?.nom) parts.push(n.nom)
  return parts.join(' › ')
}

// « exercices X à Y » ou « toute la feuille · N exercices ».
export function plageEtape(e: Etape, volume: number | null | undefined): string {
  if (e.exo_debut == null && e.exo_fin == null) {
    return volume ? `toute la feuille · ${volume} exercices` : 'toute la feuille'
  }
  return `exercices ${e.exo_debut ?? 1} à ${e.exo_fin ?? volume ?? '?'}`
}

export function nomEleve(e: EleveParcours): string {
  const nomComplet = [e.prenom, e.nom].filter(Boolean).join(' ')
  return e.pseudo ? (nomComplet ? `${e.pseudo} · ${nomComplet}` : e.pseudo) : nomComplet || e.id
}

export const btnPrimaire =
  'rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40'
export const btnSecondaire =
  'rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-40'
export const btnDanger =
  'rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40'
export const champ =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40'
export const etiquette = 'text-xs font-semibold uppercase tracking-wide text-text-muted'

// Test de positionnement : en dessous de ce nombre de questions actives, un
// set est signalé (avertissement seul).
export const QUESTIONS_FIABLES = 6

// Set à choisir automatiquement pour une étape feuille : l'unique set de la
// feuille, sinon aucun.
export function setParDefaut(feuilleId: string | null, sets: QcmSet[]): string | null {
  if (!feuilleId) return null
  const siens = sets.filter((s) => s.feuille_id === feuilleId)
  return siens.length === 1 ? siens[0].id : null
}
