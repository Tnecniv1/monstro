'use client'

import { useState, type ReactNode } from 'react'
import PastilleCompteur from '../../components/PastilleCompteur'
import ConversationView from './ConversationView'

type Onglet = 'regularite' | 'onboarding' | 'conversation'

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: 'regularite', label: 'Régularité' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'conversation', label: 'Conversation' },
]

// Régularité et Onboarding sont rendues côté serveur (page.tsx) ; seul le choix
// de l'onglet vit ici. Régularité reste l'onglet par défaut. Seule la vue
// active est montée : Conversation se charge donc à son ouverture, et tient la
// pastille des non-lus à jour quand une conversation est ouverte.
export default function SuiviTabs({
  regularite,
  onboarding,
  nonLus: nonLusInitial,
}: {
  regularite: ReactNode
  onboarding: ReactNode
  nonLus: number
}) {
  const [onglet, setOnglet] = useState<Onglet>('regularite')
  const [nonLus, setNonLus] = useState(nonLusInitial)

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
            <span className="relative">
              {o.label}
              {o.id === 'conversation' && <PastilleCompteur count={nonLus} className="absolute -right-3.5 -top-2" />}
            </span>
          </button>
        ))}
      </div>

      {onglet === 'regularite' ? regularite : onglet === 'onboarding' ? onboarding : <ConversationView onNonLusChange={setNonLus} />}
    </>
  )
}
