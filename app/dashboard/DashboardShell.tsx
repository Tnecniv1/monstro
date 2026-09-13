'use client'

import Link from 'next/link'
import { useState } from 'react'
import MatriceActiviteView from './MatriceActiviteView'
import type { WeekActivityProfile, WeekDay } from './types'

interface Props {
  matrice: WeekActivityProfile[]
  jours: WeekDay[]
  isAdmin: boolean
}

export default function DashboardShell({ matrice, jours, isAdmin }: Props) {
  const [masquerFakes, setMasquerFakes] = useState(false)

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
          <h1 className="text-2xl font-bold text-text-primary">Activité de la semaine</h1>

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

        <MatriceActiviteView
          matrice={matrice}
          jours={jours}
          isAdmin={isAdmin}
          masquerFakes={masquerFakes}
        />
      </div>
    </div>
  )
}
