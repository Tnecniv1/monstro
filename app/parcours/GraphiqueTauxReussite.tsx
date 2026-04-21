'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import type { EntHistorique } from './TableauHistorique'

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; payload: { total: number } }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow">
      <p className="text-gray-500">Bloc {label}</p>
      <p className="font-medium text-gray-900">
        {payload[0].value}%{' '}
        <span className="text-gray-400">({payload[0].payload.total} exercices)</span>
      </p>
    </div>
  )
}

export default function GraphiqueTauxReussite({ historique }: { historique: EntHistorique[] }) {
  const tries = [...historique].reverse()

  const blocs = []
  for (let i = 0; i < tries.length; i += 10) {
    const bloc = tries.slice(i, i + 10)
    const succes = bloc.filter((e) => e.observation?.etat === 'succes').length
    blocs.push({
      label: `#${Math.floor(i / 10) + 1}`,
      taux: Math.round((succes / bloc.length) * 100),
      total: bloc.length,
    })
  }

  if (blocs.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Pas encore assez de données.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={blocs} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="taux"
            stroke="#000000"
            strokeWidth={2}
            dot={{ fill: '#000000', r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
