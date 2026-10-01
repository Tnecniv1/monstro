'use client'

import { useState, type ReactNode } from 'react'

type Onglet = 'regularite' | 'parcours'

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: 'regularite', label: 'Régularité' },
  { id: 'parcours', label: 'Parcours' },
]

// Les deux vues sont rendues côté serveur (page.tsx) ; seul le choix de
// l'onglet vit ici. Régularité reste l'onglet par défaut.
export default function SuiviTabs({ regularite, parcours }: { regularite: ReactNode; parcours: ReactNode }) {
  const [onglet, setOnglet] = useState<Onglet>('regularite')

  return (
    <>
      <div role="tablist" className="inline-flex gap-0.5 rounded-xl bg-surface-2 p-1">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              onglet === o.id ? 'bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === 'regularite' ? regularite : parcours}
    </>
  )
}
