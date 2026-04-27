'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type SessionRaw = {
  date: string
  temps_min: number
  entrainement_id: string
}

function formatTemps(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`
}

function formatDateCourt(iso: string) {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow">
      <p className="text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{formatTemps(payload[0].value)}</p>
    </div>
  )
}

export default function GraphiqueConcentration({ sessions }: { sessions: SessionRaw[] }) {
  const [fullscreen, setFullscreen] = useState(false)

  const parJour = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + s.temps_min
    return acc
  }, {})

  const data = Object.entries(parJour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({
      date,
      label: formatDateCourt(date),
      minutes,
    }))

  const dataComplete = useMemo(() => {
    if (!fullscreen || data.length === 0) return data

    const first = new Date(data[0].date)
    const today = new Date()
    const parJourMap = new Map(data.map(d => [d.date, d.minutes]))

    const tous: { date: string; label: string; minutes: number }[] = []
    const cur = new Date(first)
    while (cur <= today) {
      const key = cur.toISOString().split('T')[0]
      tous.push({
        date: key,
        label: formatDateCourt(key),
        minutes: parJourMap.get(key) ?? 0,
      })
      cur.setDate(cur.getDate() + 1)
    }
    return tous
  }, [fullscreen, data])

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucune session enregistrée.
      </p>
    )
  }

  const chart = (
    <ResponsiveContainer width="100%" height={fullscreen ? 300 : 220}>
      <BarChart
        data={dataComplete}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval={fullscreen ? Math.floor(dataComplete.length / 10) : 0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
        <Bar dataKey="minutes" fill="#000000" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700">Concentration</h2>
          <button
            onClick={() => setFullscreen(false)}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            ⊠ Réduire
          </button>
        </div>
        {chart}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => setFullscreen(true)}
          className="text-xs text-gray-400 hover:text-gray-700"
        >
          ⊡ Plein écran
        </button>
      </div>
      {chart}
    </div>
  )
}
