'use client'

import { useState } from 'react'
import QcmTab from './QcmTab'
import ConversationTab from './ConversationTab'

export type Niveau = { niveau: number; nom: string }

type Ecran = 'qcm' | 'conversation'

interface Props {
  userId: string
  niveaux: Niveau[]
}

export default function ApprendreClient({ userId, niveaux }: Props) {
  const [ecran, setEcran] = useState<Ecran | null>(null)

  if (ecran === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setEcran('qcm')}
          className="bg-surface border border-border rounded-2xl py-10 px-6 text-center font-bold text-xl text-text-primary hover:bg-surface-2 transition-colors"
        >
          QCM
        </button>
        <button
          onClick={() => setEcran('conversation')}
          className="bg-surface border border-border rounded-2xl py-10 px-6 text-center font-bold text-xl text-text-primary hover:bg-surface-2 transition-colors"
        >
          Conversation
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setEcran(null)}
        className="text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        ← Apprendre
      </button>

      {ecran === 'qcm' && <QcmTab userId={userId} niveaux={niveaux} />}
      {ecran === 'conversation' && <ConversationTab userId={userId} />}
    </div>
  )
}
