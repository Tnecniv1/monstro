'use client'

import Link from 'next/link'
import { useState } from 'react'
import ActiviteView from './ActiviteView'
import RegulariteView from './RegulariteView'
import type { EnrichedProfile } from './types'

interface Props {
  enriched: EnrichedProfile[]
  dateLabel: string
  activeCount: number
  currentUserId: string
  isAdmin: boolean
}

type Onglet = 'activite' | 'regularite'

export default function DashboardShell({
  enriched,
  dateLabel,
  activeCount,
  currentUserId,
  isAdmin,
}: Props) {
  const [onglet, setOnglet] = useState<Onglet>('activite')

  function tabClass(active: boolean) {
    return active
      ? 'px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white'
      : 'px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-500 hover:text-gray-700 transition-colors'
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Retour
        </Link>

        <div className="flex items-center gap-2">
          <button className={tabClass(onglet === 'activite')} onClick={() => setOnglet('activite')}>
            Activité
          </button>
          <button className={tabClass(onglet === 'regularite')} onClick={() => setOnglet('regularite')}>
            Régularité
          </button>
        </div>

        {onglet === 'activite' && (
          <ActiviteView
            enriched={enriched}
            dateLabel={dateLabel}
            activeCount={activeCount}
          />
        )}

        {onglet === 'regularite' && (
          <RegulariteView
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  )
}
