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

export default function GraphiqueErreurs({ erreurs }: { erreurs: ErreurRaw[] }) {
  const blocs = []
  for (let i = 0; i < erreurs.length; i += 50) {
    const bloc = erreurs.slice(i, i + 50)
    blocs.push({
      label: `#${Math.floor(i / 50) + 1}`,
      comprehension: bloc.reduce((s, e) => s + e.c1 + e.c2 + e.c3 + e.c4, 0),
      savoir: bloc.reduce((s, e) => s + e.s1 + e.s2 + e.s3 + e.s4, 0),
      redaction: bloc.reduce((s, e) => s + e.r1 + e.r2 + e.r3 + e.r4, 0),
    })
  }

  if (blocs.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucune erreur enregistrée.
      </p>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={blocs} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#69707D' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#69707D' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#1F2937' }}
            itemStyle={{ color: '#1F2937' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#69707D' }} />
          <Line
            type="monotone"
            dataKey="comprehension"
            name="Compréhension"
            stroke="#6D28D9"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="savoir"
            name="Savoir"
            stroke="#3B6E96"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="redaction"
            name="Rédaction"
            stroke="#B45309"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
