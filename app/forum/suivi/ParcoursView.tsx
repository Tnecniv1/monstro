'use client'

import { useMemo, useState } from 'react'
import { ETAPES_PARCOURS, NB_ETAPES_ONBOARDING, PARCOURS_TERMINE } from './etapes'

// Ligne renvoyée par la RPC get_parcours_admin() (lève une exception hors admin).
// La RPC applique déjà la règle linéaire : rien n'est recalculé ici.
export type EleveParcours = {
  id: string
  prenom: string | null
  nom: string | null
  pseudo: string
  plan: 'abonne' | 'essai' | 'classe'
  parcours_debut_at: string | null
  pixels: number
  etape_courante: number
  etape_depuis: string | null
  etapes: (string | null)[]
}

type Tri = 'anciens' | 'recents' | 'avances' | 'moins_avances'

const TRIS: { id: Tri; label: string }[] = [
  { id: 'anciens', label: 'Plus anciens' },
  { id: 'recents', label: 'Plus récents' },
  { id: 'avances', label: 'Plus avancés' },
  { id: 'moins_avances', label: 'Moins avancés' },
]

const PLAN_LABEL: Record<EleveParcours['plan'], string> = {
  abonne: 'Abonné',
  essai: 'Essai',
  classe: 'Classe',
}

// Au-delà, l'élève est considéré bloqué sur son étape courante (orange).
const SEUIL_BLOCAGE_JOURS = 7

// Largeurs communes aux blocs de carrés et à leurs mentions, pour que
// « Onboarding » et « Niveaux 1 à 12 » restent alignés au-dessus.
const LARGEUR_ONBOARDING = 'w-[94px] sm:w-[110px]'
const LARGEUR_NIVEAUX = 'w-[142px] sm:w-[166px]'

// Jours calendaires écoulés, comptés à l'heure de Paris (même règle que
// formatJoursDepuis dans ../relativeTime.ts).
function joursDepuis(iso: string | null): number | null {
  if (!iso) return null
  const jour = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  return Math.round((Date.parse(jour(new Date())) - Date.parse(jour(new Date(iso)))) / 86_400_000)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Dates absentes en dernier, quel que soit le sens.
function comparerDates(a: string | null, b: string | null, sens: 1 | -1): number {
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  return sens * (Date.parse(a) - Date.parse(b))
}

// Tris par avancement : à étape égale, le plus longtemps bloqué en premier.
function comparer(tri: Tri) {
  return (a: EleveParcours, b: EleveParcours): number => {
    switch (tri) {
      case 'anciens':
        return comparerDates(a.parcours_debut_at, b.parcours_debut_at, 1)
      case 'recents':
        return comparerDates(a.parcours_debut_at, b.parcours_debut_at, -1)
      case 'avances':
        return b.etape_courante - a.etape_courante || comparerDates(a.etape_depuis, b.etape_depuis, 1)
      case 'moins_avances':
        return a.etape_courante - b.etape_courante || comparerDates(a.etape_depuis, b.etape_depuis, 1)
    }
  }
}

function nomAffiche(e: EleveParcours): string {
  return [e.prenom, e.nom].filter(Boolean).join(' ') || e.pseudo
}

export default function ParcoursView({ eleves }: { eleves: EleveParcours[] }) {
  const [tri, setTri] = useState<Tri>('moins_avances')
  // null = toutes les étapes ; sinon valeur de etape_courante (1 à 21).
  const [filtre, setFiltre] = useState<number | null>(null)

  const affiches = useMemo(
    () => eleves.filter((e) => filtre == null || e.etape_courante === filtre).sort(comparer(tri)),
    [eleves, tri, filtre]
  )

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="mr-auto font-semibold text-text-primary">Élèves ({affiches.length})</h2>
        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as Tri)}
          aria-label="Tri"
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
        >
          {TRIS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <select
          value={filtre ?? ''}
          onChange={(e) => setFiltre(e.target.value === '' ? null : Number(e.target.value))}
          aria-label="Filtre par étape"
          className="max-w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
        >
          <option value="">Toutes les étapes</option>
          {ETAPES_PARCOURS.map((libelle, i) => (
            <option key={i + 1} value={i + 1}>{`${i + 1} · ${libelle}`}</option>
          ))}
          <option value={PARCOURS_TERMINE}>Parcours terminé</option>
        </select>
      </div>

      {affiches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">Aucun élève</p>
      ) : (
        <>
          <div className="flex items-center gap-x-4 px-4 pt-3 text-[11px] uppercase tracking-wide text-text-muted">
            <span className="hidden sm:block sm:w-44 sm:shrink-0" />
            <div className="flex gap-3">
              <span className={LARGEUR_ONBOARDING}>Onboarding</span>
              <span className={LARGEUR_NIVEAUX}>Niveaux 1 à 12</span>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {affiches.map((e) => (
              <LigneEleve key={e.id} eleve={e} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function LigneEleve({ eleve }: { eleve: EleveParcours }) {
  const termine = eleve.etape_courante >= PARCOURS_TERMINE
  const jours = joursDepuis(eleve.etape_depuis)
  const bloque = !termine && jours != null && jours > SEUIL_BLOCAGE_JOURS

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <div className="w-full min-w-0 sm:w-44 sm:shrink-0">
        <p className="truncate font-medium text-text-primary">{nomAffiche(eleve)}</p>
        <p className="text-xs text-text-muted">{PLAN_LABEL[eleve.plan]}</p>
      </div>
      <Carres eleve={eleve} bloque={bloque} />
      <span className={`ml-auto shrink-0 tabular-nums ${bloque ? 'font-medium text-warning' : 'text-text-muted'}`}>
        {termine ? 'terminé' : jours == null ? '—' : `${jours} j`}
      </span>
    </li>
  )
}

// Plein = franchie, encadré = étape courante (orange si bloqué), vide = à venir.
function Carres({ eleve, bloque }: { eleve: EleveParcours; bloque: boolean }) {
  const carres = ETAPES_PARCOURS.map((libelle, i) => {
    const n = i + 1
    const franchieLe = eleve.etapes?.[i] ?? null
    const titre = `${n} · ${libelle}${franchieLe ? ` — franchie le ${formatDate(franchieLe)}` : ''}`
    const etat =
      n < eleve.etape_courante
        ? 'bg-accent border border-accent'
        : n === eleve.etape_courante
          ? bloque
            ? 'border-2 border-warning'
            : 'border-2 border-accent'
          : 'border border-border-strong'
    return <span key={n} title={titre} className={`h-2.5 w-2.5 shrink-0 rounded-sm sm:h-3 sm:w-3 ${etat}`} />
  })

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className={`flex justify-between ${LARGEUR_ONBOARDING}`}>{carres.slice(0, NB_ETAPES_ONBOARDING)}</div>
      <div className={`flex justify-between ${LARGEUR_NIVEAUX}`}>{carres.slice(NB_ETAPES_ONBOARDING)}</div>
    </div>
  )
}
