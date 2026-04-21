'use client'

import { useMemo, useState } from 'react'

type NoeudBase = { id: string; nom: string; parent_id: string | null }
type Noeud = NoeudBase & {
  parent: (NoeudBase & { grandparent: NoeudBase | null }) | null
}
export type Feuille = {
  id: string
  titre: string
  volume: number
  noeud: Noeud | null
}

// Chaîne d'ancêtres de la racine vers le nœud direct [grandparent?, parent?, noeud]
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

// ── Pills d'un niveau ────────────────────────────────────────────────
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

// ── Composant principal ──────────────────────────────────────────────
export default function BibliothequeClient({ feuilles }: { feuilles: Feuille[] }) {
  const [recherche, setRecherche] = useState('')
  const [chemin, setChemin] = useState<string[]>([])

  // id → nom pour le fil d'Ariane
  const idToNom = useMemo(() => {
    const map = new Map<string, string>()
    feuilles.forEach((f) =>
      getAncestorChain(f).forEach((n) => map.set(n.id, n.nom))
    )
    return map
  }, [feuilles])

  // Nodes uniques à la profondeur `depth` pour les feuilles
  // dont les ancêtres matchent chemin.slice(0, depth)
  function optionsAtDepth(depth: number): NoeudBase[] {
    const seen = new Set<string>()
    const result: NoeudBase[] = []
    feuilles.forEach((f) => {
      const chain = getAncestorChain(f)
      // Vérifie que les sélections précédentes sont respectées
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
      prev[depth] === id
        ? prev.slice(0, depth)           // re-clic → désélectionne
        : [...prev.slice(0, depth), id]  // sélectionne et tronque la suite
    )
  }

  const feuillesFiltrees = useMemo(() => {
    const q = recherche.toLowerCase()
    return feuilles.filter((f) => {
      const ids = getAncestorIds(f)
      const matchChemin = chemin.every((id) => ids.includes(id))
      const matchRecherche =
        !q ||
        f.titre.toLowerCase().includes(q) ||
        cheminFeuille(f).toLowerCase().includes(q)
      return matchChemin && matchRecherche
    })
  }, [feuilles, chemin, recherche])

  const filAriane = chemin.map((id) => idToNom.get(id) ?? id).join(' › ')

  return (
    <div className="space-y-4">
      {/* Recherche */}
      <input
        type="text"
        placeholder="Rechercher par titre ou chemin…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />

      {/* Filtres en cascade */}
      {depth0Options.length > 0 && (
        <PillsRow
          options={depth0Options}
          activeId={chemin[0] ?? null}
          onSelect={(id) => select(0, id)}
        />
      )}
      {chemin[0] && depth1Options.length > 0 && (
        <PillsRow
          options={depth1Options}
          activeId={chemin[1] ?? null}
          onSelect={(id) => select(1, id)}
        />
      )}
      {chemin[1] && depth2Options.length > 0 && (
        <PillsRow
          options={depth2Options}
          activeId={chemin[2] ?? null}
          onSelect={(id) => select(2, id)}
        />
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
        <p className="text-center text-sm text-gray-400 py-12">
          Aucune feuille trouvée.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {feuillesFiltrees.map((f) => {
            const chemin = cheminFeuille(f)
            const racine = getAncestorChain(f)[0]
            return (
              <div
                key={f.id}
                className="rounded-xl border border-gray-200 bg-white p-5 space-y-3"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900 leading-snug">{f.titre}</p>
                  {chemin && (
                    <p className="text-xs text-gray-400">{chemin}</p>
                  )}
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
