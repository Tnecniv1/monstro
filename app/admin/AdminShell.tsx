'use client'

import { useState } from 'react'
import AdminClient, { type Noeud } from './AdminClient'
import CorrectionsClient, { type FeuilleRow } from './corrections/CorrectionsClient'
import AbonnementsView from './AbonnementsView'
import CommunicationView, { type EleveCommunication } from './CommunicationView'
import GlobalView from './GlobalView'
import UtilisateursView from './UtilisateursView'

type Onglet = 'scope' | 'correction' | 'abonnements' | 'utilisateurs' | 'communication' | 'global'

const TABS: { id: Onglet; label: string }[] = [
  { id: 'scope', label: 'Scope' },
  { id: 'correction', label: 'Correction' },
  { id: 'abonnements', label: 'Abonnements' },
  { id: 'utilisateurs', label: 'Utilisateurs' },
  { id: 'communication', label: 'Communication' },
  { id: 'global', label: 'Global' },
]

export default function AdminShell({
  noeuds,
  feuilles,
  eleves,
}: {
  noeuds: Noeud[]
  feuilles: FeuilleRow[]
  eleves: EleveCommunication[]
}) {
  const [onglet, setOnglet] = useState<Onglet>('scope')

  return (
    <div className="space-y-6">
      {/* Segmented control */}
      <div
        style={{
          display: 'inline-flex',
          background: '#EDEAE3',
          borderRadius: 12,
          padding: 4,
          gap: 2,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setOnglet(tab.id)}
            style={{
              padding: '6px 18px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: onglet === tab.id ? '#ffffff' : 'transparent',
              color: onglet === tab.id ? '#1a1a1a' : '#9ca3af',
              boxShadow: onglet === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {onglet === 'scope' && <AdminClient noeuds={noeuds} />}
      {onglet === 'correction' && <CorrectionsClient feuilles={feuilles} />}
      {onglet === 'abonnements' && <AbonnementsView />}
      {onglet === 'utilisateurs' && <UtilisateursView />}
      {onglet === 'communication' && <CommunicationView eleves={eleves} />}
      {onglet === 'global' && <GlobalView />}
    </div>
  )
}
