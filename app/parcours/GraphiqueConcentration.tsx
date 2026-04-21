'use client'

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
  const parJour = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + s.temps_min
    return acc
  }, {})

  const data = Object.entries(parJour).map(([date, minutes]) => ({
    date: formatDateCourt(date),
    minutes,
  }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucune session enregistrée.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
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
    </div>
  )
}
