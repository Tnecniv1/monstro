'use client'

import { useState } from 'react'
import AdminClient, { type Noeud } from './AdminClient'
import CorrectionsClient, { type FeuilleRow } from './corrections/CorrectionsClient'
import AbonnementsView from './AbonnementsView'
import AgoraAdminView, { type EleveAgora } from './AgoraAdminView'
import GlobalView from './GlobalView'
import UtilisateursView from './UtilisateursView'
import ForumScriptsView from './ForumScriptsView'
import ForumCardManager from './ForumCardManager'
import ParcoursObjectifView from './ParcoursObjectifView'
import QcmView from './QcmView'
import type { EleveParcours } from './parcoursObjectifTypes'

type Onglet = 'scope' | 'correction' | 'cours' | 'abonnements' | 'utilisateurs' | 'agora' | 'global' | 'forum' | 'objectifs' | 'qcm'

const TABS: { id: Onglet; label: string }[] = [
  { id: 'scope', label: 'Scope' },
  { id: 'correction', label: 'Correction' },
  { id: 'cours', label: 'Cours' },
  { id: 'abonnements', label: 'Abonnements' },
  { id: 'utilisateurs', label: 'Utilisateurs' },
  { id: 'agora', label: 'Agora' },
  { id: 'global', label: 'Global' },
  { id: 'forum', label: 'Forum' },
  { id: 'objectifs', label: 'Objectifs' },
  { id: 'qcm', label: 'QCM' },
]

export default function AdminShell({
  noeuds,
  feuilles,
  eleves,
  elevesParcours,
}: {
  noeuds: Noeud[]
  feuilles: FeuilleRow[]
  eleves: EleveAgora[]
  elevesParcours: EleveParcours[]
}) {
  const [onglet, setOnglet] = useState<Onglet>('scope')
  // Feuille ouverte dans l'onglet QCM (« Modifier les questions » depuis
  // Objectifs) ; null : aucune.
  const [qcmFeuilleId, setQcmFeuilleId] = useState<string | null>(null)

  function ouvrirQcm(feuilleId: string) {
    setQcmFeuilleId(feuilleId)
    setOnglet('qcm')
  }

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
      {/* Cours de la Bibliothèque (table forum_resources), web et mobile. */}
      {onglet === 'cours' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Cours</h2>
          <ForumCardManager table="forum_resources" createLabel="+ Nouveau cours" itemLabelSingular="cours" masculin />
        </div>
      )}
      {onglet === 'abonnements' && <AbonnementsView />}
      {onglet === 'utilisateurs' && <UtilisateursView />}
      {onglet === 'agora' && <AgoraAdminView eleves={eleves} />}
      {onglet === 'global' && <GlobalView />}
      {onglet === 'forum' && <ForumScriptsView />}
      {onglet === 'objectifs' && (
        <ParcoursObjectifView noeuds={noeuds} feuilles={feuilles} eleves={elevesParcours} onModifierQuestions={ouvrirQcm} />
      )}
      {onglet === 'qcm' && <QcmView feuilles={feuilles} feuilleInitialeId={qcmFeuilleId} />}
    </div>
  )
}
