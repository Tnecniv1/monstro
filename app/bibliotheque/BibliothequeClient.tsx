'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NoeudBase = { id: string; nom: string; parent_id: string | null }
type Noeud = NoeudBase & {
  parent: (NoeudBase & { grandparent: NoeudBase | null }) | null
}
export type Feuille = {
  id: string
  titre: string
  volume: number
  pdf_url: string | null
  noeud: Noeud | null
}

function getAncestorChain(feuille: Feuille): NoeudBase[] {
  const n = feuille.noeud
  if (!n) return []
  const chain: NoeudBase[] = []
  if (n.parent?.grandparent) chain.push(n.parent.grandparent)
  if (n.parent) chain.push(n.parent)
  chain.push(n)
  return chain
}

function getAncestorIds(feuille: Feuille): string[] {
  return getAncestorChain(feuille).map((n) => n.id)
}

function cheminFeuille(feuille: Feuille): string {
  return getAncestorChain(feuille).map((n) => n.nom).join(' › ')
}

function PillsRow({
  options,
  activeId,
  onSelect,
}: {
  options: NoeudBase[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeId === opt.id
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {opt.nom}
        </button>
      ))}
    </div>
  )
}

interface Props {
  feuilles: Feuille[]
  focusIds: Set<string>
  termineIds: Set<string>
  userId: string
}

export default function BibliothequeClient({ feuilles, focusIds: initialFocusIds, termineIds, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [focusIds, setFocusIds] = useState<Set<string>>(initialFocusIds)
  const [showFocusOnly, setShowFocusOnly] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [chemin, setChemin] = useState<string[]>([])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function toggleFocus(e: React.MouseEvent, feuilleId: string) {
    e.stopPropagation()
    if (termineIds.has(feuilleId)) return

    if (focusIds.has(feuilleId)) {
      setFocusIds((prev) => { const s = new Set(prev); s.delete(feuilleId); return s })
      await supabase.from('feuille_focus').delete().eq('user_id', userId).eq('feuille_id', feuilleId)
      router.refresh()
    } else {
      if (focusIds.size >= 3) {
        showToast('Maximum 3 feuilles en focus')
        return
      }
      setFocusIds((prev) => new Set(prev).add(feuilleId))
      await supabase.from('feuille_focus').insert({ user_id: userId, feuille_id: feuilleId })
      router.refresh()
    }
  }

  const idToNom = useMemo(() => {
    const map = new Map<string, string>()
    feuilles.forEach((f) => getAncestorChain(f).forEach((n) => map.set(n.id, n.nom)))
    return map
  }, [feuilles])

  function optionsAtDepth(depth: number): NoeudBase[] {
    const seen = new Set<string>()
    const result: NoeudBase[] = []
    feuilles.forEach((f) => {
      const chain = getAncestorChain(f)
      for (let d = 0; d < depth; d++) {
        if (chain[d]?.id !== chemin[d]) return
      }
      const node = chain[depth]
      if (node && !seen.has(node.id)) {
        seen.add(node.id)
        result.push(node)
      }
    })
    return result.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }

  const depth0Options = useMemo(() => optionsAtDepth(0), [feuilles])
  const depth1Options = useMemo(
    () => (chemin[0] ? optionsAtDepth(1) : []),
    [feuilles, chemin[0]]
  )
  const depth2Options = useMemo(
    () => (chemin[1] ? optionsAtDepth(2) : []),
    [feuilles, chemin[0], chemin[1]]
  )

  function select(depth: number, id: string) {
    setChemin((prev) =>
      prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id]
    )
  }

  const feuillesFiltrees = useMemo(() => {
    const q = recherche.toLowerCase()
    return feuilles.filter((f) => {
      if (showFocusOnly && !focusIds.has(f.id)) return false
      const ids = getAncestorIds(f)
      const matchChemin = chemin.every((id) => ids.includes(id))
      const matchRecherche =
        !q || f.titre.toLowerCase().includes(q) || cheminFeuille(f).toLowerCase().includes(q)
      return matchChemin && matchRecherche
    })
  }, [feuilles, chemin, recherche, showFocusOnly, focusIds])

  const filAriane = chemin.map((id) => idToNom.get(id) ?? id).join(' › ')

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Recherche */}
      <input
        type="text"
        placeholder="Rechercher par titre ou chemin…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />

      {/* Filtre Focus */}
      <button
        onClick={() => setShowFocusOnly((v) => !v)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          showFocusOnly
            ? 'bg-yellow-400 text-yellow-900'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        • Focus
      </button>

      {/* Filtres en cascade */}
      {depth0Options.length > 0 && (
        <PillsRow options={depth0Options} activeId={chemin[0] ?? null} onSelect={(id) => select(0, id)} />
      )}
      {chemin[0] && depth1Options.length > 0 && (
        <PillsRow options={depth1Options} activeId={chemin[1] ?? null} onSelect={(id) => select(1, id)} />
      )}
      {chemin[1] && depth2Options.length > 0 && (
        <PillsRow options={depth2Options} activeId={chemin[2] ?? null} onSelect={(id) => select(2, id)} />
      )}

      {/* Fil d'Ariane */}
      {chemin.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{filAriane}</span>
          <button
            onClick={() => setChemin([])}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors leading-none"
            aria-label="Réinitialiser les filtres"
          >
            ×
          </button>
        </div>
      )}

      {/* Résultats */}
      {feuillesFiltrees.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">Aucune feuille trouvée.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {feuillesFiltrees.map((f) => {
            const chemin = cheminFeuille(f)
            const racine = getAncestorChain(f)[0]
            const isTermine = termineIds.has(f.id)
            const isFocus = focusIds.has(f.id)

            return (
              <div
                key={f.id}
                onClick={() => f.pdf_url && window.open(f.pdf_url, '_blank')}
                className={`relative rounded-xl border border-gray-200 bg-white p-5 space-y-3 ${
                  f.pdf_url ? 'cursor-pointer hover:border-gray-400 transition-colors' : 'cursor-default opacity-60'
                }`}
              >
                {/* Pastille coin supérieur droit */}
                <button
                  onClick={(e) => toggleFocus(e, f.id)}
                  className="absolute top-3 right-3"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: isTermine ? '#6C5CE7' : isFocus ? '#FFD93D' : 'transparent',
                    border: isTermine || isFocus ? 'none' : '1.5px solid #D1D5DB',
                    cursor: isTermine ? 'default' : 'pointer',
                  }}
                  aria-label={isTermine ? 'Terminée' : isFocus ? 'Retirer du focus' : 'Ajouter au focus'}
                />

                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900 leading-snug">{f.titre}</p>
                  {chemin && <p className="text-xs text-gray-400">{chemin}</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {racine && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
                      {racine.nom}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
                    {f.volume} exercice{f.volume > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
