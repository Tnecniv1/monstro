'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Mission, MissionType } from '../types'
import { MissionCard } from './MissionCard'

const FILTRES: { label: string; value: MissionType | 'all' }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Argent', value: 'argent' },
  { label: 'Sagesse', value: 'sagesse' },
  { label: 'Preuve', value: 'preuve' },
]

interface CatalogueMissionsProps {
  missions: Mission[]
  missionsAchetees: string[]
  soldeCredits: number
  userId: string
}

export function CatalogueMissions({
  missions,
  missionsAchetees,
  soldeCredits,
  userId,
}: CatalogueMissionsProps) {
  const supabase = createClient()
  const router = useRouter()
  const [filtre, setFiltre] = useState<MissionType | 'all'>('all')
  const [missionSelectionnee, setMissionSelectionnee] = useState<Mission | null>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const missionsFiltrees = filtre === 'all'
    ? missions
    : missions.filter((m) => m.type === filtre)

  async function handleAcheter(mission: Mission) {
    setMissionSelectionnee(mission)
    setErreur(null)
  }

  async function confirmerAchat() {
    if (!missionSelectionnee) return
    setLoading(true)
    setErreur(null)

    const { data: transaction, error: errTx } = await supabase
      .from('credit_transaction')
      .insert({
        user_id: userId,
        type: 'achat_mission',
        montant: -missionSelectionnee.cout_credits,
        mission_id: missionSelectionnee.id,
      })
      .select('id')
      .single()

    if (errTx || !transaction) {
      setErreur('Erreur lors du débit. Réessaie.')
      setLoading(false)
      return
    }

    const { error: errAchat } = await supabase.from('mission_achat').insert({
      user_id: userId,
      mission_id: missionSelectionnee.id,
      credit_transaction_id: transaction.id,
      statut: 'en_cours',
    })

    if (errAchat) {
      setErreur("Erreur lors de l'achat. Réessaie.")
      setLoading(false)
      return
    }

    setMissionSelectionnee(null)
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a' }}>Catalogue des missions</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTRES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFiltre(value)}
              style={
                filtre === value
                  ? { fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '0.5px solid #1a1a1a', background: '#1a1a1a', color: '#fff', cursor: 'pointer' }
                  : { fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: '#888780', cursor: 'pointer' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {missionsFiltrees.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            soldeCredits={soldeCredits}
            achetee={missionsAchetees.includes(mission.id)}
            onAcheter={handleAcheter}
          />
        ))}
      </div>

      {missionsFiltrees.length === 0 && (
        <p style={{ fontSize: 14, color: '#b0ada6', textAlign: 'center', marginTop: 48 }}>
          Aucune mission disponible dans cette catégorie.
        </p>
      )}

      {missionSelectionnee && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => !loading && setMissionSelectionnee(null)}
        >
          <div
            style={{ background: '#F5F3EE', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 16, padding: 24, width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Confirmer l'achat
              </p>
              <p style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a' }}>{missionSelectionnee.titre}</p>
            </div>

            <div style={{ background: '#EDEAE3', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888780' }}>Coût</span>
                <span style={{ fontWeight: 500, color: '#E24B4A' }}>
                  −{missionSelectionnee.cout_credits.toLocaleString('fr-FR')} T
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888780' }}>Profit</span>
                <span style={{ fontWeight: 500, color: '#1D9E75' }}>
                  {missionSelectionnee.profit ?? '—'}
                </span>
              </div>
            </div>

            {erreur && (
              <p style={{ fontSize: 12, color: '#E24B4A', textAlign: 'center' }}>{erreur}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setMissionSelectionnee(null)}
                disabled={loading}
                style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent', color: '#1a1a1a', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={confirmerAchat}
                disabled={loading}
                style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                {loading ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
