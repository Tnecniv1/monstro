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

interface SessionUniqueRow {
  jour: string
  nb_sessions_uniques: number
}

interface ChartRow extends SessionUniqueRow {
  label: string
  moyenne_mobile_7j: number
}

function formatJour(j: string): string {
  const date = new Date(j)
  if (isNaN(date.getTime())) return j
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// Moyenne mobile sur 7 jours : pour chaque point, moyenne de nb_sessions_uniques
// sur ce jour + les 6 précédents disponibles dans le tableau (trié par jour croissant).
// Pour les 6 premiers points, la moyenne se fait sur les jours disponibles seulement.
function avecMoyenneMobile(rows: SessionUniqueRow[]): ChartRow[] {
  return rows.map((row, idx) => {
    const fenetre = rows.slice(Math.max(0, idx - 6), idx + 1)
    const moyenne = fenetre.reduce((sum, r) => sum + r.nb_sessions_uniques, 0) / fenetre.length
    return {
      ...row,
      label: formatJour(row.jour),
      moyenne_mobile_7j: Math.round(moyenne * 100) / 100,
    }
  })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-md text-sm text-[#1a1a1a]">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name} : <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function GlobalView() {
  const supabase = createClient()
  const [data, setData] = useState<SessionUniqueRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('get_sessions_uniques_par_jour', { jours: 180 })
      .then(({ data: rows }) => {
        if (!cancelled) {
          setData((rows as SessionUniqueRow[]) ?? [])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const formatted = avecMoyenneMobile(data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Vue Global — sessions uniques par jour</h2>
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
                tick={{ fontSize: 12, fill: '#a78bfa' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 13 }} />
              <Line
                type="monotone"
                dataKey="nb_sessions_uniques"
                name="Sessions uniques"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="moyenne_mobile_7j"
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
