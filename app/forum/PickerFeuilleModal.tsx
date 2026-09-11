'use client'

import { useMemo, useState } from 'react'
import type { FeuilleTopic } from './types'

interface Props {
  options: FeuilleTopic[]
  onClose: () => void
  onPick: (feuille: FeuilleTopic) => void
}

export default function PickerFeuilleModal({ options, onClose, onPick }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((f) => f.titre.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h2 className="font-semibold text-text-primary text-sm">Épingler une feuille</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-muted hover:text-text-secondary transition-colors text-xl leading-none p-2 -mr-2"
          >
            ×
          </button>
        </div>

        <div className="px-4 pt-3 shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Rechercher une feuille…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <ul className="overflow-y-auto flex-1 px-2 py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-text-muted text-center py-6">Aucune feuille trouvée.</p>
          )}
          {filtered.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => onPick(f)}
                className="w-full text-left rounded-lg px-3 py-2.5 text-sm text-text-primary hover:bg-surface-2 transition-colors"
              >
                {f.titre}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
