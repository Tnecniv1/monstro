'use client'

import { useMemo, useState } from 'react'
import { champ, cheminFeuille, type FeuilleChoix } from './parcoursObjectifTypes'

// Choix d'une feuille de la bibliothèque, recherche par titre ou chemin
// (même principe que NouvelEntrainementModal côté élève).
export default function FeuillePicker({
  feuilles,
  selectionId,
  onChoisir,
}: {
  feuilles: FeuilleChoix[]
  selectionId: string | null
  onChoisir: (f: FeuilleChoix) => void
}) {
  const [recherche, setRecherche] = useState('')

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return feuilles
    return feuilles.filter(
      (f) => f.titre.toLowerCase().includes(q) || cheminFeuille(f).toLowerCase().includes(q)
    )
  }, [feuilles, recherche])

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher par titre ou chemin…"
        className={champ}
        autoFocus
      />
      <ul className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-surface">
        {filtrees.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">Aucune feuille.</li>}
        {filtrees.map((f) => {
          const choisie = f.id === selectionId
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onChoisir(f)}
                className={`w-full px-3 py-2 text-left transition-colors ${choisie ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
              >
                <span className={`block text-sm ${choisie ? 'font-semibold text-accent' : 'text-text-primary'}`}>
                  {f.titre}
                </span>
                <span className="block text-xs text-text-muted">
                  {cheminFeuille(f) || 'Sans catégorie'}
                  {f.volume ? ` · ${f.volume} exercices` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
