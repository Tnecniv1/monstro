'use client'

import { useMemo, useState } from 'react'
import { ETAPES_PARCOURS, ETAPES_PARCOURS_COURTES, GROUPES_ETAPES, PARCOURS_TERMINE } from './etapes'

// Ligne renvoyée par la RPC get_parcours_admin() (lève une exception hors admin).
// etapes[N-1] est la date de l'étape N, ou null si elle n'est pas faite ;
// chaque étape est datée indépendamment des autres.
export type LigneParcours = {
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

// Ligne affichée : faites[N-1] dit si l'étape N est faite, indépendamment des
// autres (etapesFaites), et etape_courante est la première étape non faite.
export type EleveParcours = LigneParcours & { faites: boolean[] }

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

// Indices (0-based) des étapes qui ouvrent un groupe, sauf le premier :
// trait vertical à leur gauche, sur toute la hauteur du tableau.
const DEBUTS_GROUPES = new Set(
  GROUPES_ETAPES.slice(1).map((_, i) => GROUPES_ETAPES.slice(0, i + 1).reduce((t, g) => t + g.nb, 0))
)
const SEPARATEUR = 'border-l border-border'

// Colonne des noms figée à gauche pendant le défilement horizontal.
const COLONNE_NOM = 'sticky left-0 z-10 bg-surface'

// Trait fin entre deux élèves.
const CELLULE = 'border-t border-border'

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
        // Seul le tableau défile horizontalement s'il dépasse la largeur.
        // table-fixed : largeurs fixes pour les noms et « Depuis » (padding
        // compris), les 20 colonnes d'étapes se partagent le reste à parts
        // égales ; en dessous de 900 px, défilement plutôt qu'écrasement.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col className="w-52" />
              {ETAPES_PARCOURS.map((_, i) => (
                <col key={i} />
              ))}
              <col className="w-20" />
            </colgroup>
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-text-muted">
                <th rowSpan={2} scope="col" className={`${COLONNE_NOM} px-4`}>
                  <span className="sr-only">Élève</span>
                </th>
                {GROUPES_ETAPES.map((g, i) => (
                  <th
                    key={g.libelle}
                    colSpan={g.nb}
                    scope="colgroup"
                    className={`px-1.5 pb-1 pt-3 text-left font-normal ${i > 0 ? SEPARATEUR : ''}`}
                  >
                    {g.libelle}
                  </th>
                ))}
                <th rowSpan={2} scope="col" className="pb-2 pl-2 pr-4 text-right align-bottom font-normal">
                  Depuis
                </th>
              </tr>
              <tr>
                {ETAPES_PARCOURS.map((libelle, i) => (
                  <th
                    key={i}
                    scope="col"
                    title={libelle}
                    className={`px-1.5 pb-2 align-bottom text-xs font-normal text-text-secondary ${DEBUTS_GROUPES.has(i) ? SEPARATEUR : ''}`}
                  >
                    {/* Lecture de bas en haut. */}
                    <span className="inline-block rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">
                      {`${i + 1} · ${ETAPES_PARCOURS_COURTES[i]}`}
                    </span>
                  </th>
                ))}
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

function LigneEleve({ eleve }: { eleve: EleveParcours }) {
  const termine = eleve.etape_courante >= PARCOURS_TERMINE
  const jours = joursDepuis(eleve.etape_depuis)
  const bloque = !termine && jours != null && jours > SEUIL_BLOCAGE_JOURS

  return (
    <tr>
      <th scope="row" className={`${COLONNE_NOM} ${CELLULE} px-4 py-4 text-left font-normal`}>
        <div className="w-44">
          <p className="truncate font-medium text-text-primary">{nomAffiche(eleve)}</p>
          <p className="text-xs text-text-muted">{PLAN_LABEL[eleve.plan]}</p>
        </div>
      </th>
      {ETAPES_PARCOURS.map((libelle, i) => (
        <td key={i} className={`${CELLULE} px-1.5 ${DEBUTS_GROUPES.has(i) ? SEPARATEUR : ''}`}>
          <Carre eleve={eleve} i={i} libelle={libelle} bloque={bloque} />
        </td>
      ))}
      <td
        className={`${CELLULE} whitespace-nowrap pl-2 pr-4 text-right tabular-nums ${bloque ? 'font-medium text-warning' : 'text-text-muted'}`}
      >
        {termine ? 'terminé' : jours == null ? '—' : `${jours} j`}
      </td>
    </tr>
  )
}

// Plein = faite, vide = non faite ; encadré = étape courante, c'est-à-dire la
// première non faite (orange si bloqué).
function Carre({ eleve, i, libelle, bloque }: { eleve: EleveParcours; i: number; libelle: string; bloque: boolean }) {
  const n = i + 1
  const franchieLe = eleve.etapes?.[i] ?? null
  const titre = `${n} · ${libelle}${franchieLe ? ` — franchie le ${formatDate(franchieLe)}` : ''}`
  const etat =
    eleve.faites[i]
      ? 'bg-accent border border-accent'
      : n === eleve.etape_courante
        ? bloque
          ? 'border-2 border-warning'
          : 'border-2 border-accent'
        : 'border border-border-strong'
  return <span title={titre} className={`mx-auto block h-4 w-4 rounded-sm ${etat}`} />
}
