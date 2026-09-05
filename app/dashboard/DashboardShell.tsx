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
  const [masquerFakes, setMasquerFakes] = useState(false)

  function tabClass(active: boolean) {
    return active
      ? 'px-4 py-2 rounded-lg text-sm font-medium bg-surface-2 border border-border-strong text-text-primary'
      : 'px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text-muted hover:text-text-secondary transition-colors'
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/"
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
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
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setMasquerFakes((v) => !v)}>
              <span className="text-sm text-text-secondary">Masquer les faux élèves</span>
              <div
                role="switch"
                aria-checked={masquerFakes}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  masquerFakes ? 'bg-accent' : 'bg-surface-2'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-text-primary shadow transition-transform ${
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
      </div>
    </div>
  )
}
