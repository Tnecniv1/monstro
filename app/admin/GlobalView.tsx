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

// Ligne de get_ratio_acces_par_jour : ratios entre 0 et 1, null sans photo.
interface RatioRow {
  jour: string
  abonnes: number
  actifs: number
  ratio: number | null
  ratio_7j: number | null
}

interface ChartRow extends RatioRow {
  label: string
  ratio_pct: number | null
  ratio_7j_pct: number | null
}

const NBSP = String.fromCharCode(0xa0)

function formatJour(j: string): string {
  const date = new Date(j)
  if (isNaN(date.getTime())) return j
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function pourcent(r: number | null): number | null {
  return r == null ? null : Math.round(r * 1000) / 10
}

// La courbe démarre au premier jour qui a une photo des abonnés.
function versGraphique(rows: RatioRow[]): ChartRow[] {
  const premier = rows.findIndex((r) => r.ratio != null)
  if (premier === -1) return []
  return rows.slice(premier).map((row) => ({
    ...row,
    label: formatJour(row.jour),
    ratio_pct: pourcent(row.ratio),
    ratio_7j_pct: pourcent(row.ratio_7j),
  }))
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { payload: ChartRow }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-md text-sm text-[#1a1a1a]">
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: '#a78bfa' }}>
        {row.ratio_pct == null
          ? 'Pas de photo des abonnés ce jour-là'
          : `${row.actifs} / ${row.abonnes} abonnés actifs (${Math.round(row.ratio_pct)}${NBSP}%)`}
      </p>
      {row.ratio_7j_pct != null && (
        <p style={{ color: '#f97316' }}>
          Moyenne 7 j : <span className="font-medium">{Math.round(row.ratio_7j_pct)}{NBSP}%</span>
        </p>
      )}
    </div>
  )
}

export default function GlobalView() {
  const supabase = createClient()
  const [data, setData] = useState<RatioRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('get_ratio_acces_par_jour', { jours: 180 })
      .then(({ data: rows }) => {
        if (!cancelled) {
          setData((rows as RatioRow[]) ?? [])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const formatted = versGraphique(data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Vue Global — part des abonnés actifs par jour</h2>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-400 text-sm">Chargement…</div>
        ) : formatted.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
            Pas encore de données : la première photo des abonnés est prise ce soir.
          </div>
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
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}${NBSP}%`}
                tick={{ fontSize: 12, fill: '#a78bfa' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 13 }} />
              <Line
                type="monotone"
                dataKey="ratio_pct"
                name="Abonnés actifs du jour"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="ratio_7j_pct"
                name="Moyenne mobile 7j"
                stroke="#f97316"
                strokeWidth={3}
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
