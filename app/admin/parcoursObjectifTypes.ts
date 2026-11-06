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

export type ClasseExamen = '3e' | '1re' | 'terminale'

export type Etape = {
  id: string
  parcours_id: string
  ordre: number
  type: 'feuille' | 'examen'
  feuille_id: string | null
  exo_debut: number | null
  exo_fin: number | null
  libelle: string | null
  classe_examen: ClasseExamen | null
}

export type Assignation = {
  user_id: string
  parcours_id: string
  date_objectif: string | null
}

// Élève tel que chargé par admin/page.tsx pour l'onglet Objectifs.
export type EleveParcours = {
  id: string
  pseudo: string | null
  prenom: string | null
  nom: string | null
}

export type FeuilleChoix = FeuilleRow

export const CLASSES_EXAMEN: { valeur: ClasseExamen; libelle: string }[] = [
  { valeur: '3e', libelle: '3e' },
  { valeur: '1re', libelle: '1re' },
  { valeur: 'terminale', libelle: 'Terminale' },
]

export function libelleClasse(valeur: string | null): string {
  if (!valeur) return ''
  return CLASSES_EXAMEN.find((c) => c.valeur === valeur)?.libelle ?? valeur
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
