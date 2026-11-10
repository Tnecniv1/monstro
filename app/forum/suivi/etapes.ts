// Étapes de l'onboarding d'un élève (onglet Onboarding du suivi), dans
// l'ordre. Fonctions pures, sans Supabase ni React.
//
// Une étape est faite si sa condition est vraie ; chacune est évaluée
// indépendamment des autres. Étape en cours = première non faite ; toutes
// faites = onboarding terminé.
// 1. Objectif : une ligne parcours_eleve (date : parcours_eleve.created_at).
// 2. Position : parcours_eleve.positionnement_at non nul.
// 3. Script #1 : user_profile.script1_ouvert_at non nul.
// 4. Premier « Commencer » : au moins un entraînement (date : le plus ancien
//    entrainement.date_creation).
// 5. Première session : au moins une session sur un de ses entraînements
//    (date : la plus ancienne session.date, un jour).
// 6. Premier entraînement terminé : au moins un entraînement au statut
//    'termine' (date : le plus ancien termine_at).
//
// Depuis (élève non terminé) : jours écoulés depuis la date la plus récente
// des étapes faites, ou depuis l'inscription si aucune étape n'est datée.
//
// Exemple : parcours_eleve créé le 03/11, positionnement_at null,
// script1_ouvert_at le 03/11, un entraînement créé le 04/11 sans session
// → faites [vrai, faux, vrai, vrai, faux, faux], étape en cours = 2
// (Position), Depuis = jours écoulés depuis le 04/11.

import { lireDate } from '@/lib/parcours/progression'

export const ETAPES_ONBOARDING = [
  'Objectif',
  'Position',
  'Script #1',
  'Premier « Commencer »',
  'Première session',
  'Premier entraînement terminé',
] as const

// Intitulés courts, même ordre : en-têtes de colonnes de l'onglet.
export const ETAPES_ONBOARDING_COURTES = ['Objectif', 'Position', 'Script #1', 'Commencer', 'Session', 'Terminé'] as const

export type DonneesOnboardingEleve = {
  inscritLe: string | null
  objectifLe: string | null
  positionLe: string | null
  script1Le: string | null
  // Dates de création des entraînements, et de fin des entraînements terminés.
  entrainementsCreesLe: (string | null)[]
  entrainementsTerminesLe: (string | null)[]
  // Jours des sessions ('AAAA-MM-JJ').
  sessionsLe: string[]
  aUnObjectif: boolean
  aUnEntrainement: boolean
  aUnTermine: boolean
}

export type EtapeEleve = { fait: boolean; date: string | null }

export type OnboardingEleve = {
  etapes: EtapeEleve[]
  // Index (0 à 5) de la première étape non faite ; null : onboarding terminé.
  enCours: number | null
  // Date ISO servant au calcul de « Depuis » (dernière étape faite, sinon
  // inscription) ; null si aucune.
  depuisLe: string | null
}

// Plus ancienne date lisible (ISO) d'une liste ; null si aucune.
function plusAncienne(dates: (string | null)[]): string | null {
  let meilleure: string | null = null
  let t0 = Infinity
  for (const d of dates) {
    const t = lireDate(d)
    if (!isNaN(t) && t < t0) {
      t0 = t
      meilleure = d
    }
  }
  return meilleure
}

// Jour 'AAAA-MM-JJ' → midi UTC (même jour à Paris), lisible par lireDate.
function jourEnIso(jour: string): string {
  return `${jour.slice(0, 10)}T12:00:00Z`
}

export function onboardingEleve(d: DonneesOnboardingEleve): OnboardingEleve {
  const sessions = d.sessionsLe.map(jourEnIso)
  const etapes: EtapeEleve[] = [
    { fait: d.aUnObjectif, date: d.objectifLe },
    { fait: d.positionLe != null, date: d.positionLe },
    { fait: d.script1Le != null, date: d.script1Le },
    { fait: d.aUnEntrainement, date: plusAncienne(d.entrainementsCreesLe) },
    { fait: sessions.length > 0, date: plusAncienne(sessions) },
    { fait: d.aUnTermine, date: plusAncienne(d.entrainementsTerminesLe) },
  ]
  const i = etapes.findIndex((e) => !e.fait)

  let depuisLe: string | null = null
  let t0 = -Infinity
  for (const e of etapes) {
    const t = lireDate(e.date)
    if (e.fait && !isNaN(t) && t > t0) {
      t0 = t
      depuisLe = e.date
    }
  }

  return { etapes, enCours: i === -1 ? null : i, depuisLe: depuisLe ?? d.inscritLe }
}
