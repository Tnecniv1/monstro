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
import { SECTIONS_ERREURS, type CompteursErreurs } from '@/lib/erreurs'

export type ErreurRaw = CompteursErreurs & { entrainement: { date_creation: string } }

// Couleur de chaque courbe, dans l'ordre de SECTIONS_ERREURS (Compréhension, Savoir, Rédaction).
const COULEURS = ['#6D28D9', '#3B6E96', '#B45309']

export default function GraphiqueErreurs({ erreurs }: { erreurs: ErreurRaw[] }) {
  const blocs: Record<string, string | number>[] = []
  for (let i = 0; i < erreurs.length; i += 50) {
    const bloc = erreurs.slice(i, i + 50)
    const point: Record<string, string | number> = { label: `#${Math.floor(i / 50) + 1}` }
    // Total de chaque section sur le bloc (somme de ses quatre compteurs).
    for (const s of SECTIONS_ERREURS) {
      point[s.titre] = bloc.reduce((t, e) => t + s.items.reduce((u, item) => u + e[item.cle], 0), 0)
    }
    blocs.push(point)
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
          {SECTIONS_ERREURS.map((s, i) => (
            <Line
              key={s.titre}
              type="monotone"
              dataKey={s.titre}
              name={s.titre}
              stroke={COULEURS[i]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
