'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AbonnementRow {
  user_id: string
  pseudo: string
  statut: string
  price_id: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  updated_at: string
}

const ACTIVE_STATUTS = ['active', 'trialing']

function formatDateFR(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function StatutBadge({ statut }: { statut: string }) {
  let bg: string
  let color: string
  let label: string

  switch (statut) {
    case 'active':
      bg = '#dcfce7'
      color = '#166534'
      label = 'Actif'
      break
    case 'trialing':
      bg = '#dcfce7'
      color = '#166534'
      label = 'Essai'
      break
    case 'past_due':
      bg = '#fee2e2'
      color = '#991b1b'
      label = 'En retard'
      break
    case 'unpaid':
      bg = '#fee2e2'
      color = '#991b1b'
      label = 'Impayé'
      break
    case 'paused':
      bg = '#ede9fe'
      color = '#5b21b6'
      label = 'En pause'
      break
    case 'canceled':
      bg = '#f3f4f6'
      color = '#6b7280'
      label = 'Annulé'
      break
    default:
      bg = '#f3f4f6'
      color = '#6b7280'
      label = statut
  }

  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  )
}

export default function AbonnementsView() {
  const [rows, setRows] = useState<AbonnementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    supabase.rpc('get_abonnements_admin').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) {
        setError(rpcError.message)
      } else {
        setRows((data as AbonnementRow[]) ?? [])
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const activeCount = rows.filter((r) => ACTIVE_STATUTS.includes(r.statut)).length
  const mrr = activeCount * 50

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1a1a1a]">Abonnements</h2>

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Abonnés actifs
          </p>
          {loading ? (
            <p className="text-2xl font-bold text-[#1a1a1a]">—</p>
          ) : (
            <p className="text-3xl font-bold text-[#1a1a1a]">{activeCount}</p>
          )}
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Revenu mensuel récurrent (MRR)
          </p>
          {loading ? (
            <p className="text-2xl font-bold text-[#1a1a1a]">—</p>
          ) : (
            <p className="text-3xl font-bold text-[#4ade80]">
              {mrr.toLocaleString('fr-FR')}&nbsp;€
            </p>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-gray-400 text-sm">
            Chargement…
          </div>
        ) : error ? (
          <div className="flex h-32 items-center justify-center text-red-400 text-sm">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-400 text-sm">
            Aucun abonné pour le moment.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Pseudo
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Statut
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Prochain renouvellement
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Dernière MàJ
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.user_id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-[#1a1a1a]">
                    {row.pseudo || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <StatutBadge statut={row.statut} />
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDateFR(row.current_period_end)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDateFR(row.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
