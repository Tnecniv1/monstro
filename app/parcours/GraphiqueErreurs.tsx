'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export type ErreurRaw = {
  c1: number; c2: number; c3: number; c4: number
  s1: number; s2: number; s3: number; s4: number
  r1: number; r2: number; r3: number; r4: number
  entrainement: { date_creation: string }
}

function formatDateCourt(iso: string) {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

export default function GraphiqueErreurs({ erreurs }: { erreurs: ErreurRaw[] }) {
  const data = erreurs.map(e => ({
    label: formatDateCourt(e.entrainement.date_creation.split('T')[0]),
    comprehension: e.c1 + e.c2 + e.c3 + e.c4,
    savoir: e.s1 + e.s2 + e.s3 + e.s4,
    redaction: e.r1 + e.r2 + e.r3 + e.r4,
  }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucune erreur enregistrée.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="comprehension"
            name="Compréhension"
            stroke="#6C5CE7"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="savoir"
            name="Savoir"
            stroke="#00D084"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="redaction"
            name="Rédaction"
            stroke="#FF6B35"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
