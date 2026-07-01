'use client'

import Link from 'next/link'
import { useState } from 'react'
import ActiviteView from './ActiviteView'
import RegulariteView from './RegulariteView'
import CommunicationView from './CommunicationView'
import GlobalView from './GlobalView'
import AbonnementsView from './AbonnementsView'
import type { EnrichedProfile } from './types'

interface Props {
  enriched: EnrichedProfile[]
  dateLabel: string
  activeCount: number
  currentUserId: string
  isAdmin: boolean
}

type Onglet = 'activite' | 'regularite' | 'communication' | 'global' | 'abonnements'

export default function DashboardShell({
  enriched,
  dateLabel,
  activeCount,
  currentUserId,
  isAdmin,
}: Props) {
  const [onglet, setOnglet] = useState<Onglet>('activite')
  const [masquerFakes, setMasquerFakes] = useState(false)

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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className={tabClass(onglet === 'activite')} onClick={() => setOnglet('activite')}>
              Activité
            </button>
            <button className={tabClass(onglet === 'regularite')} onClick={() => setOnglet('regularite')}>
              Régularité
            </button>
            {isAdmin && (
              <button className={tabClass(onglet === 'communication')} onClick={() => setOnglet('communication')}>
                Communication
              </button>
            )}
            {isAdmin && (
              <button className={tabClass(onglet === 'global')} onClick={() => setOnglet('global')}>
                Global
              </button>
            )}
            {isAdmin && (
              <button className={tabClass(onglet === 'abonnements')} onClick={() => setOnglet('abonnements')}>
                Abonnements
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setMasquerFakes((v) => !v)}>
              <span className="text-sm text-gray-500">Masquer les faux élèves</span>
              <div
                role="switch"
                aria-checked={masquerFakes}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  masquerFakes ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    masquerFakes ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {onglet === 'activite' && (
          <ActiviteView
            enriched={enriched}
            dateLabel={dateLabel}
            activeCount={activeCount}
            masquerFakes={masquerFakes}
          />
        )}

        {onglet === 'regularite' && (
          <RegulariteView
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            masquerFakes={masquerFakes}
          />
        )}

        {onglet === 'communication' && isAdmin && (
          <CommunicationView enriched={enriched} />
        )}

        {onglet === 'global' && isAdmin && (
          <GlobalView />
        )}

        {onglet === 'abonnements' && isAdmin && (
          <AbonnementsView />
        )}
      </div>
    </div>
  )
}
