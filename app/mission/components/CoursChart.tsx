'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { TauxConversion } from '../types'

interface CoursChartProps {
  historique: TauxConversion[]
}

export function CoursChart({ historique }: CoursChartProps) {
  const data = historique.map((t) => ({
    date: new Date(t.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }),
    taux: t.taux,
  }))

  const tauxActuel = historique.at(-1)?.taux ?? 100
  const tauxPrecedent = historique.at(-2)?.taux ?? tauxActuel
  const variation = tauxActuel - tauxPrecedent
  const variationPct = tauxPrecedent > 0
    ? ((variation / tauxPrecedent) * 100).toFixed(1)
    : '0.0'

  const taux7j = historique.slice(-7).map((t) => t.taux)
  const min7j = Math.min(...taux7j)
  const max7j = Math.max(...taux7j)
  const totalTransactions = historique.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780' }}>
          Cours du token
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a' }}>
            1 px = {tauxActuel} T
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: variation >= 0 ? '#1D9E75' : '#E24B4A' }}>
            {variation >= 0 ? '▲' : '▼'} {variation >= 0 ? '+' : ''}{variationPct}%
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#888780' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#888780' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '0.5px solid rgba(0,0,0,0.1)',
                background: '#fff',
                color: '#1a1a1a',
              }}
              formatter={(value: number) => [`${value} T/px`, 'Taux']}
            />
            <Line
              type="monotone"
              dataKey="taux"
              stroke="#1D9E75"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#1D9E75' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        {[
          { label: '7j min', value: min7j },
          { label: '7j max', value: max7j },
          { label: 'Transactions', value: totalTransactions },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, background: '#EDEAE3', borderRadius: 8, padding: '8px 10px' }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780' }}>
              {label}
            </p>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
