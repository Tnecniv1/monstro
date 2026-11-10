'use client'

import { useMemo, useState } from 'react'
import { lireDate } from '@/lib/parcours/progression'
import { ETAPES_ONBOARDING, ETAPES_ONBOARDING_COURTES, type OnboardingEleve } from './etapes'

// Élève affiché dans l'onglet Onboarding (chargé par page.tsx).
export type EleveOnboarding = {
  id: string
  nom: string
  plan: 'abonne' | 'essai' | 'classe'
  inscritLe: string | null
  // Nom du parcours (infobulle de l'étape Objectif) et point de départ du
  // test (infobulle de l'étape Position : titre de la feuille, ou « début »).
  parcoursNom: string | null
  depart: string | null
  // Niveau de la PixelGrid (1 à 12, lib/pixels.ts) et nombre de pixels.
  niveau: number
  pixels: number
  onboarding: OnboardingEleve
}

type FiltrePlan = 'tous' | EleveOnboarding['plan']

const FILTRES: { id: FiltrePlan; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'abonne', label: 'Abonné' },
  { id: 'classe', label: 'Classe' },
  { id: 'essai', label: 'Essai' },
]

const PLAN_LABEL: Record<EleveOnboarding['plan'], string> = {
  abonne: 'Abonné',
  essai: 'Essai',
  classe: 'Classe',
}

// Carrés des étapes : faite, en cours (première non faite), pas encore faite.
const VIOLET = '#6D28D9'
const JAUNE = '#FACC15'

// Au-delà, « Depuis » passe en orange.
const SEUIL_BLOCAGE_JOURS = 7

const COLONNE_NOM = 'sticky left-0 z-10 bg-surface'
// En-têtes : même taille, même graisse, gris discret, une seule ligne, en bas.
const ENTETE = 'whitespace-nowrap px-2 pb-2 pt-3 align-bottom text-xs font-medium text-text-secondary'
const CELLULE = 'border-t border-border'

function jourParis(t: number): string {
  return new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

// Jours calendaires écoulés, comptés à l'heure de Paris.
function joursDepuis(iso: string | null): number | null {
  const t = lireDate(iso)
  if (isNaN(t)) return null
  return Math.round((Date.parse(jourParis(Date.now())) - Date.parse(jourParis(t))) / 86_400_000)
}

// Plus récemment inscrits en premier ; date illisible en dernier.
function comparer(a: EleveOnboarding, b: EleveOnboarding): number {
  const da = lireDate(a.inscritLe)
  const db = lireDate(b.inscritLe)
  if (isNaN(da) !== isNaN(db)) return isNaN(da) ? 1 : -1
  return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da)
}

// « 2 à l'étape Position, 1 à l'étape Première session · 5 onboarding terminés ».
function resume(eleves: EleveOnboarding[]): string {
  const morceaux = ETAPES_ONBOARDING.map((libelle, i) => {
    const n = eleves.filter((e) => e.onboarding.enCours === i).length
    return n > 0 ? `${n} à l’étape ${libelle}` : null
  }).filter((m): m is string => m !== null)
  const termines = eleves.filter((e) => e.onboarding.enCours === null).length
  const fin = `${termines} onboarding terminé${termines > 1 ? 's' : ''}`
  return morceaux.length > 0 ? `${morceaux.join(', ')} · ${fin}` : fin
}

export default function OnboardingView({ eleves }: { eleves: EleveOnboarding[] }) {
  const [filtre, setFiltre] = useState<FiltrePlan>('tous')

  const affiches = useMemo(
    () => eleves.filter((e) => filtre === 'tous' || e.plan === filtre).sort(comparer),
    [eleves, filtre]
  )

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold text-text-primary">Élèves ({affiches.length})</h2>
          <div role="group" aria-label="Filtre par plan" className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
            {FILTRES.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtre === f.id}
                onClick={() => setFiltre(f.id)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  filtre === f.id ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-text-secondary">{resume(affiches)}</p>
      </div>

      {affiches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">Aucun élève</p>
      ) : (
        // Seul le tableau défile horizontalement s'il dépasse la largeur.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[976px] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col className="w-44" />
              {/* Six colonnes d'étapes de largeur identique. */}
              {ETAPES_ONBOARDING.map((_, i) => (
                <col key={i} className="w-[88px]" />
              ))}
              <col className="w-28" />
              <col className="w-40" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className={`${COLONNE_NOM} ${ENTETE} px-4`}>
                  <span className="sr-only">Élève</span>
                </th>
                {ETAPES_ONBOARDING.map((libelle, i) => (
                  <th key={i} scope="col" title={libelle} className={`${ENTETE} text-center`}>
                    {`${i + 1} ${ETAPES_ONBOARDING_COURTES[i]}`}
                  </th>
                ))}
                <th scope="col" className={`${ENTETE} text-left`}>Niveau</th>
                <th scope="col" className={`${ENTETE} pr-4 text-right`}>Depuis</th>
              </tr>
            </thead>
            <tbody>
              {affiches.map((e) => (
                <LigneEleve key={e.id} eleve={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function LigneEleve({ eleve }: { eleve: EleveOnboarding }) {
  const { etapes, enCours, depuisLe } = eleve.onboarding
  const termine = enCours === null
  const jours = termine ? null : joursDepuis(depuisLe)
  const bloque = jours != null && jours > SEUIL_BLOCAGE_JOURS

  return (
    <tr>
      <th scope="row" className={`${COLONNE_NOM} ${CELLULE} px-4 py-3 text-left font-normal`}>
        <p className="truncate font-medium text-text-primary">{eleve.nom}</p>
        <p className="text-xs text-text-muted">{PLAN_LABEL[eleve.plan]}</p>
      </th>
      {etapes.map((etape, i) => {
        const courante = i === enCours
        const etat = etape.fait ? 'faite' : courante ? 'en cours' : 'pas encore faite'
        const detail = i === 0 && etape.fait ? eleve.parcoursNom : i === 1 && etape.fait ? eleve.depart : null
        const titre = `${i + 1}. ${ETAPES_ONBOARDING[i]} : ${etat}${detail ? ` · ${i === 1 ? 'départ : ' : ''}${detail}` : ''}`
        return (
          <td key={i} className={`${CELLULE} px-2 py-3`}>
            <span
              title={titre}
              aria-label={titre}
              role="img"
              className="mx-auto block h-4 w-4 rounded-sm"
              style={
                etape.fait
                  ? { background: VIOLET }
                  : courante
                    ? { background: JAUNE }
                    : { background: '#FFFFFF', border: '1px solid #D1D5DB' }
              }
            />
          </td>
        )
      })}
      <td
        className={`${CELLULE} whitespace-nowrap px-2 py-3 tabular-nums text-text-secondary`}
        title={`${eleve.pixels} pixel${eleve.pixels > 1 ? 's' : ''}`}
      >
        Niveau {eleve.niveau}/12
      </td>
      <td
        className={`${CELLULE} whitespace-nowrap py-3 pl-2 pr-4 text-right tabular-nums ${
          termine ? 'font-medium text-success' : bloque ? 'font-medium text-warning' : 'text-text-muted'
        }`}
      >
        {termine ? 'Onboarding terminé' : jours == null ? '—' : `${jours} j`}
      </td>
    </tr>
  )
}
