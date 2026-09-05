'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Granularite = 'week' | 'day'

interface GlobalRow {
  periode: string
  temps_total_min: number
  temps_moyen_min: number
  nb_utilisateurs: number
}

function formatPeriode(p: string): string {
  const date = new Date(p)
  if (isNaN(date.getTime())) return p
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { color: string; name: string; value: number; payload: GlobalRow }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-md text-sm text-[#1a1a1a]">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name} : <span className="font-medium">{Math.round(p.value)} min</span>
        </p>
      ))}
      {row && (
        <p className="mt-1 text-gray-400 text-xs">{row.nb_utilisateurs} utilisateur{row.nb_utilisateurs !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

export default function GlobalView() {
  const supabase = createClient()
  const [granularite, setGranularite] = useState<Granularite>('week')
  const [data, setData] = useState<GlobalRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('get_dashboard_global', { granularite })
      .then(({ data: rows }) => {
        if (!cancelled) {
          setData((rows as GlobalRow[]) ?? [])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [granularite])

  const formatted = data.map((row) => ({
    ...row,
    label: formatPeriode(row.periode),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Vue Global — temps d&apos;entraînement</h2>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          {(['week', 'day'] as Granularite[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularite(g)}
              className={`px-4 py-1.5 transition-colors ${
                granularite === g
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 hover:text-gray-700'
              }`}
            >
              {g === 'week' ? 'Semaine' : 'Jour'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-400 text-sm">Chargement…</div>
        ) : formatted.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-gray-400 text-sm">Aucune donnée disponible.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={formatted} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 12, fill: '#a78bfa' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v} min`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#4ade80' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v} min`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 13 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="temps_total_min"
                name="Temps total"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="temps_moyen_min"
                name="Moyenne / élève"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
