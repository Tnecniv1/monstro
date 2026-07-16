'use client'

import { useState } from 'react'
import QcmTab from './QcmTab'
import ConversationTab from './ConversationTab'

export type Niveau = { niveau: number; nom: string }

type Onglet = 'qcm' | 'formation' | 'conversation'

interface Props {
  userId: string
  niveaux: Niveau[]
}

export default function ApprendreClient({ userId, niveaux }: Props) {
  const [onglet, setOnglet] = useState<Onglet>('qcm')

  function tabClass(active: boolean, disabled: boolean) {
    if (disabled) {
      return 'px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-300 cursor-not-allowed'
    }
    return active
      ? 'px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white'
      : 'px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button className={tabClass(onglet === 'qcm', false)} onClick={() => setOnglet('qcm')}>
          QCM
        </button>
        <button className={tabClass(false, true)} disabled title="Bientôt disponible">
          Formation <span className="text-gray-300">· bientôt</span>
        </button>
        <button className={tabClass(onglet === 'conversation', false)} onClick={() => setOnglet('conversation')}>
          Conversation
        </button>
      </div>

      {onglet === 'qcm' && (
        <QcmTab userId={userId} niveaux={niveaux} />
      )}

      {onglet === 'conversation' && (
        <ConversationTab userId={userId} />
      )}
    </div>
  )
}
