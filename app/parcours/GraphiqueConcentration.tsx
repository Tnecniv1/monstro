'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatTemps } from './format'

export type SessionRaw = {
  date: string
  temps_min: number
  entrainement_id: string
}

type Jour = { date: string; minutes: number }

const VIOLET = '#6D28D9'
const GRILLE = '#ECECEF'
const TEXTE_AXE = '#69707D'
const JOUR_MS = 86400000

// Les dates sont des jours calendaires 'AAAA-MM-JJ' : on les manipule en UTC
// pour ne pas dépendre du fuseau du navigateur.
function versDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`)
}

// Aujourd'hui à Paris, au format AAAA-MM-JJ (en-CA).
function aujourdhuiParis() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const fmtJourCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const fmtJourLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// « 3 nov » (sans le point de l'abréviation).
function etiquetteSemaine(iso: string) {
  return fmtJourCourt.format(versDate(iso)).replace(/\.$/, '')
}

// « nov. 26 »
function etiquetteMois(iso: string) {
  return fmtMois.format(versDate(iso))
}

// Graduation de l'axe Y : « 30 min », « 1h », « 1h30 ».
function etiquetteMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// 4 ou 5 graduations rondes (0 compris), avec un pas en minutes parmi PAS.
const PAS = [5, 10, 15, 30, 60, 120, 240, 480]
function graduationsY(max: number) {
  const pas = PAS.find((p) => Math.ceil(max / p) <= 4) ?? PAS[PAS.length - 1]
  const n = Math.max(3, Math.ceil(max / pas))
  return Array.from({ length: n + 1 }, (_, i) => i * pas)
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { value: number; payload: Jour }[]
}) {
  if (!active || !payload?.length) return null
  const { date, minutes } = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow">
      <p className="text-text-muted">{fmtJourLong.format(versDate(date))}</p>
      <p className="font-medium text-text-primary">{formatTemps(minutes)}</p>
    </div>
  )
}

// Concentration : minutes de session par jour (somme des sessions du jour),
// chaque jour du premier jour de session à aujourd'hui (0 sans session).
export default function GraphiqueConcentration({ sessions }: { sessions: SessionRaw[] }) {
  const [fullscreen, setFullscreen] = useState(false)

  const { jours, ticksX, parMois, ticksY } = useMemo(() => {
    const parJour = new Map<string, number>()
    for (const s of sessions) parJour.set(s.date, (parJour.get(s.date) ?? 0) + s.temps_min)
    const dates = Array.from(parJour.keys()).sort()
    if (dates.length === 0) return { jours: [] as Jour[], ticksX: [] as string[], parMois: false, ticksY: [] as number[] }

    const premier = dates[0]
    const today = aujourdhuiParis()
    const fin = Math.max(versDate(today).getTime(), versDate(dates[dates.length - 1]).getTime())
    const jours: Jour[] = []
    for (let t = versDate(premier).getTime(); t <= fin; t += JOUR_MS) {
      const date = new Date(t).toISOString().slice(0, 10)
      jours.push({ date, minutes: parJour.get(date) ?? 0 })
    }

    // Plus de 6 mois : une étiquette le 1er de chaque mois, sinon chaque lundi.
    const sixMois = versDate(premier)
    sixMois.setUTCMonth(sixMois.getUTCMonth() + 6)
    const parMois = fin > sixMois.getTime()
    const ticksX = jours
      .map((j) => j.date)
      .filter((d) => (parMois ? d.endsWith('-01') : versDate(d).getUTCDay() === 1))

    const max = Math.max(...jours.map((j) => j.minutes))
    return { jours, ticksX, parMois, ticksY: graduationsY(max) }
  }, [sessions])

  if (jours.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        Aucune session enregistrée.
      </p>
    )
  }

  const chart = (
    <ResponsiveContainer width="100%" height={fullscreen ? 300 : 220}>
      <BarChart data={jours} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="15%">
        <CartesianGrid vertical={false} stroke={GRILLE} />
        <XAxis
          dataKey="date"
          ticks={ticksX}
          interval={0}
          tickFormatter={parMois ? etiquetteMois : etiquetteSemaine}
          tick={{ fontSize: 11, fill: TEXTE_AXE }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          ticks={ticksY}
          domain={[0, ticksY[ticksY.length - 1]]}
          tickFormatter={etiquetteMinutes}
          tick={{ fontSize: 11, fill: TEXTE_AXE }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F3F4F6' }} />
        <Bar dataKey="minutes" fill={VIOLET} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary">Concentration</h2>
          <button
            onClick={() => setFullscreen(false)}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            ⊠ Réduire
          </button>
        </div>
        {chart}
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-1">
        <button
          onClick={() => setFullscreen(true)}
          className="text-xs text-text-muted hover:text-text-secondary"
        >
          ⊡ Plein écran
        </button>
      </div>
      {chart}
    </div>
  )
}
