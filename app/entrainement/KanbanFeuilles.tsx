'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NoeudBase = { id: string; nom: string; parent_id: string | null }
type Noeud = NoeudBase & {
  parent: (NoeudBase & { grandparent: NoeudBase | null }) | null
}

type EntRow = {
  id: string
  feuille_id: string
  ref_exo: number
  statut: string
  date_creation: string
  feuille_entrainement: {
    id: string
    titre: string
    volume: number
    noeud: Noeud | null
  } | null
  observation: { etat: string } | null
  session: { temps_min: number }[]
}

type FeuilleKanban = {
  feuilleId: string
  titre: string
  volume: number
  chemin: string
  exoFaits: number
  termines: number
  succes: number
  tauxReussite: number
  tempsTotal: number
  dernierActivite: string
  isFocus: boolean
  entrainements: EntRow[]
}

type Colonne = 'nonTerminees' | 'aRetravailler' | 'maitrisees'

const COLONNES: { key: Colonne; titre: string }[] = [
  { key: 'nonTerminees', titre: 'Non terminées' },
  { key: 'aRetravailler', titre: 'À retravailler' },
  { key: 'maitrisees', titre: 'Maîtrisées' },
]

const ETAT_STYLE: Record<string, string> = {
  succes: 'bg-green-100 text-green-700',
  echec: 'bg-red-100 text-red-700',
  corrige: 'bg-blue-100 text-blue-700',
}
const ETAT_LABEL: Record<string, string> = {
  succes: 'Succès',
  echec: 'Échec',
  corrige: 'Corrigé',
}

function formatTemps(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`
}

function formatDateCourt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function couleurTaux(taux: number) {
  if (taux >= 80) return 'text-green-600'
  if (taux >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function cheminNoeud(noeud: Noeud | null): string {
  if (!noeud) return ''
  const chain: string[] = []
  if (noeud.parent?.grandparent) chain.push(noeud.parent.grandparent.nom)
  if (noeud.parent) chain.push(noeud.parent.nom)
  chain.push(noeud.nom)
  return chain.join(' › ')
}

function grouperParFeuille(rows: EntRow[], focusIds: Set<string>): FeuilleKanban[] {
  const map = new Map<string, FeuilleKanban>()

  for (const e of rows) {
    const feuille = e.feuille_entrainement
    if (!feuille) continue

    const tempsEnt = e.session.reduce((s, sess) => s + sess.temps_min, 0)

    if (!map.has(feuille.id)) {
      map.set(feuille.id, {
        feuilleId: feuille.id,
        titre: feuille.titre,
        volume: feuille.volume,
        chemin: cheminNoeud(feuille.noeud),
        exoFaits: 0,
        termines: 0,
        succes: 0,
        tauxReussite: 0,
        tempsTotal: 0,
        dernierActivite: e.date_creation,
        isFocus: focusIds.has(feuille.id),
        entrainements: [],
      })
    }

    const ligne = map.get(feuille.id)!
    ligne.exoFaits += 1
    if (e.statut === 'termine') ligne.termines += 1
    if (e.observation?.etat === 'succes') ligne.succes += 1
    ligne.tempsTotal += tempsEnt
    ligne.entrainements.push(e)
    if (e.date_creation > ligne.dernierActivite) ligne.dernierActivite = e.date_creation
  }

  const lignes = Array.from(map.values())
  for (const l of lignes) {
    l.tauxReussite = Math.round((l.succes / l.exoFaits) * 100)
  }
  return lignes
}

function classerColonne(l: FeuilleKanban): Colonne {
  if (l.termines < l.volume) return 'nonTerminees'
  if (l.tauxReussite < 75) return 'aRetravailler'
  return 'maitrisees'
}

function trierColonne(lignes: FeuilleKanban[]): FeuilleKanban[] {
  return [...lignes].sort((a, b) => b.dernierActivite.localeCompare(a.dernierActivite))
}

const FOCUS_MAX = 3

function LigneEntrainement({ e }: { e: EntRow }) {
  const etat = e.observation?.etat ?? null
  const style = etat ? (ETAT_STYLE[etat] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-500'
  const label = etat ? (ETAT_LABEL[etat] ?? etat) : 'En cours'
  const temps = e.session.reduce((s, sess) => s + sess.temps_min, 0)

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <span className="text-gray-700 font-medium flex-shrink-0">Exo {e.ref_exo}</span>
      <span className={`rounded px-1.5 py-0.5 font-medium flex-shrink-0 ${style}`}>{label}</span>
      <span className="text-gray-400 ml-auto flex-shrink-0">{formatDateCourt(e.date_creation)}</span>
      <span className="text-gray-500 w-12 text-right flex-shrink-0">
        {temps > 0 ? `${temps} min` : ''}
      </span>
    </div>
  )
}

function CarteFeuille({
  l,
  isOpen,
  onToggle,
  layout = 'colonne',
}: {
  l: FeuilleKanban
  isOpen: boolean
  onToggle: () => void
  layout?: 'colonne' | 'focus'
}) {
  const pct = Math.min(100, Math.round((l.termines / l.volume) * 100))
  const entrainementsTries = useMemo(
    () => [...l.entrainements].sort((a, b) => a.ref_exo - b.ref_exo),
    [l.entrainements],
  )
  const widthClass = layout === 'focus' ? 'w-64 flex-shrink-0' : 'w-64 flex-shrink-0 md:w-full'

  return (
    <div className={`${widthClass} rounded-xl border border-gray-200 bg-white overflow-hidden`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            onToggle()
          }
        }}
        className="p-3 space-y-2 cursor-pointer select-none"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-gray-900 text-sm leading-snug flex-1">{l.titre}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            {l.isFocus && (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: '#FFD93D' }}
                aria-label="En focus"
                title="En focus"
              />
            )}
            <span
              className={`text-gray-400 text-xs inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}
            >
              ▸
            </span>
          </div>
        </div>

        {l.chemin && <p className="text-xs text-gray-400 truncate">{l.chemin}</p>}

        <div className="space-y-1">
          <span className="text-gray-700 text-xs">
            {l.termines} / {l.volume} exercices
          </span>
          <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-black transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          {l.termines > 0 ? (
            <span className={`font-semibold ${couleurTaux(l.tauxReussite)}`}>{l.tauxReussite}%</span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
          <span className="text-gray-500">{l.tempsTotal > 0 ? formatTemps(l.tempsTotal) : '—'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50 divide-y divide-gray-100">
          {entrainementsTries.map((e) => (
            <LigneEntrainement key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function KanbanFeuilles({ userId }: { userId: string }) {
  const supabase = createClient()

  const [rows, setRows] = useState<EntRow[]>([])
  const [focusIds, setFocusIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function charger() {
      setLoading(true)
      const [{ data: entRows }, { data: focusRows }] = await Promise.all([
        supabase
          .from('entrainement')
          .select(`
            id, feuille_id, ref_exo, statut, date_creation,
            feuille_entrainement (
              id, titre, volume,
              noeud:noeud_id (
                id, nom, parent_id,
                parent:parent_id (
                  id, nom, parent_id,
                  grandparent:parent_id ( id, nom )
                )
              )
            ),
            observation ( etat ),
            session ( temps_min )
          `)
          .eq('user_id', userId),
        supabase.from('feuille_focus').select('feuille_id').eq('user_id', userId),
      ])

      if (cancelled) return
      setRows((entRows ?? []) as unknown as EntRow[])
      setFocusIds(new Set(((focusRows ?? []) as { feuille_id: string }[]).map((f) => f.feuille_id)))
      setLoading(false)
    }

    charger()
    return () => {
      cancelled = true
    }
  }, [userId, supabase])

  function toggleOpen(feuilleId: string) {
    console.log('[toggleOpen] appelé avec feuilleId =', feuilleId)
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(feuilleId)) next.delete(feuilleId)
      else next.add(feuilleId)
      return next
    })
  }

  const { colonnes, focusLignes } = useMemo(() => {
    const lignes = grouperParFeuille(rows, focusIds)
    const groupes: Record<Colonne, FeuilleKanban[]> = {
      nonTerminees: [],
      aRetravailler: [],
      maitrisees: [],
    }
    for (const l of lignes) groupes[classerColonne(l)].push(l)
    for (const key of Object.keys(groupes) as Colonne[]) {
      groupes[key] = trierColonne(groupes[key])
    }
    const focus = lignes
      .filter((l) => l.isFocus)
      .sort((a, b) => b.dernierActivite.localeCompare(a.dernierActivite))
      .slice(0, FOCUS_MAX)
    return { colonnes: groupes, focusLignes: focus }
  }, [rows, focusIds])

  const total = colonnes.nonTerminees.length + colonnes.aRetravailler.length + colonnes.maitrisees.length

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
  }

  if (total === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucune feuille commencée pour l&apos;instant.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {focusLignes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Focus
          </h3>
          <div className="flex flex-row flex-wrap gap-3">
            {focusLignes.map((l) => (
              <CarteFeuille
                key={l.feuilleId}
                l={l}
                layout="focus"
                isOpen={openIds.has(l.feuilleId)}
                onToggle={() => toggleOpen(l.feuilleId)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLONNES.map(({ key, titre }) => (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {titre}{' '}
              <span className="text-gray-400 normal-case font-normal">
                ({colonnes[key].length})
              </span>
            </h3>
            <div className="flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-1">
              {colonnes[key].length === 0 ? (
                <p className="text-xs text-gray-300">Aucune feuille</p>
              ) : (
                colonnes[key].map((l) => (
                  <CarteFeuille
                    key={l.feuilleId}
                    l={l}
                    isOpen={openIds.has(l.feuilleId)}
                    onToggle={() => toggleOpen(l.feuilleId)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
