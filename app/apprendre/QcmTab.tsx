'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Niveau } from './ApprendreClient'
import QcmSession from './QcmSession'
import GridTile, { GRID_CONTAINER_CLASS, type EtatTuile } from './GridTile'

export type Stats = { total: number; vues: number; vrai: number; faux: number; corrige: number }

const STATS_VIDES: Stats = { total: 0, vues: 0, vrai: 0, faux: 0, corrige: 0 }

interface Props {
  userId: string
  niveaux: Niveau[]
}

export default function QcmTab({ userId, niveaux }: Props) {
  const supabase = createClient()

  const [statsParNiveau, setStatsParNiveau] = useState<Record<number, Stats>>({})
  const [validesForce, setValidesForce] = useState<Set<number>>(new Set())
  const [niveauActif, setNiveauActif] = useState<Niveau | null>(null)

  useEffect(() => {
    let annule = false

    async function charger() {
      const { data, error } = await supabase.rpc('qcm_stats_tous_niveaux')
      if (annule || error || !data) return

      const map: Record<number, Stats> = {}
      for (const row of data as (Stats & { niveau: number })[]) {
        map[row.niveau] = {
          total: row.total,
          vues: row.vues,
          vrai: row.vrai,
          faux: row.faux,
          corrige: row.corrige,
        }
      }
      setStatsParNiveau(map)
    }

    charger()
    return () => {
      annule = true
    }
  }, [])

  function marquerValide(niveau: number) {
    setValidesForce((prev) => new Set(prev).add(niveau))
  }

  function majStats(niveau: number, stats: Stats) {
    setStatsParNiveau((prev) => ({ ...prev, [niveau]: stats }))
  }

  if (niveauActif) {
    const stats = statsParNiveau[niveauActif.niveau] ?? STATS_VIDES
    return (
      <QcmSession
        userId={userId}
        niveau={niveauActif}
        statsInitial={stats}
        onValidated={marquerValide}
        onStatsUpdate={majStats}
        onExit={() => setNiveauActif(null)}
      />
    )
  }

  if (niveaux.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-12">Aucun niveau disponible pour l&apos;instant.</p>
  }

  const indexCourant = niveaux.findIndex((n) => {
    const stats = statsParNiveau[n.niveau] ?? STATS_VIDES
    return !(validesForce.has(n.niveau) || (stats.total > 0 && stats.vrai + stats.corrige === stats.total))
  })

  return (
    <div className={GRID_CONTAINER_CLASS}>
      {niveaux.map((n, i) => {
        const stats = statsParNiveau[n.niveau] ?? STATS_VIDES
        const valide = validesForce.has(n.niveau) || (stats.total > 0 && stats.vrai + stats.corrige === stats.total)
        const etat: EtatTuile = valide ? 'terminee' : i === indexCourant ? 'disponible' : 'verrouille'
        return (
          <GridTile key={n.niveau} onClick={() => setNiveauActif(n)} etat={etat}>
            <span className="font-bold font-display text-base">Niveau {n.niveau}</span>
            <span className="italic font-display text-sm">{n.nom}</span>
            <span className="mt-1.5 text-xs">
              {stats.vues}/{stats.total}
            </span>
            <span className="text-xs">
              V{stats.vrai} F{stats.faux} C{stats.corrige}
            </span>
          </GridTile>
        )
      })}
    </div>
  )
}
