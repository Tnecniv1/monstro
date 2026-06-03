'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MissionTypeBadge } from './MissionTypeBadge'
import { MissionType } from '../types'

interface AchatEnCours {
  id: string
  created_at: string
  mission: {
    titre: string
    type: MissionType
    profit: string | null
  }
  user_profile: {
    pseudo: string
  }
}

export function AdminValidationPanel() {
  const supabase = createClient()
  const [achats, setAchats] = useState<AchatEnCours[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<string>('all')
  const [validating, setValidating] = useState<string | null>(null)

  useEffect(() => {
    async function charger() {
      const { data } = await supabase
        .from('mission_achat')
        .select('*, mission(*), user_profile:user_id(pseudo)')
        .eq('statut', 'en_cours')
        .order('created_at', { ascending: false })

      setAchats((data as AchatEnCours[]) ?? [])
      setLoading(false)
    }
    charger()
  }, [])

  const pseudos = Array.from(new Set(achats.map((a) => a.user_profile.pseudo))).sort()

  const achatsFiltres = filtre === 'all'
    ? achats
    : achats.filter((a) => a.user_profile.pseudo === filtre)

  async function handleValider(id: string) {
    setValidating(id)
    const { error } = await supabase
      .from('mission_achat')
      .update({ statut: 'validee' })
      .eq('id', id)

    if (!error) {
      setAchats((prev) => prev.filter((a) => a.id !== id))
    }
    setValidating(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, color: '#888780', fontSize: 14 }}>
        Chargement…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filtre par élève */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFiltre('all')}
          style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
            border: '0.5px solid rgba(0,0,0,0.15)',
            background: filtre === 'all' ? '#1a1a1a' : 'transparent',
            color: filtre === 'all' ? '#fff' : '#888780',
          }}
        >
          Tous les élèves
        </button>
        {pseudos.map((pseudo) => (
          <button
            key={pseudo}
            onClick={() => setFiltre(pseudo)}
            style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
              border: '0.5px solid rgba(0,0,0,0.15)',
              background: filtre === pseudo ? '#1a1a1a' : 'transparent',
              color: filtre === pseudo ? '#fff' : '#888780',
            }}
          >
            {pseudo}
          </button>
        ))}
      </div>

      {/* Liste des missions */}
      {achatsFiltres.length === 0 ? (
        <p style={{ fontSize: 14, color: '#b0ada6', textAlign: 'center', padding: '24px 0' }}>
          Aucune mission en attente de validation.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {achatsFiltres.map((achat) => (
            <div
              key={achat.id}
              style={{
                background: '#fff',
                border: '0.5px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                  {achat.user_profile.pseudo}
                </span>
                <span style={{ fontSize: 11, color: '#b0ada6' }}>
                  {new Date(achat.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MissionTypeBadge type={achat.mission.type} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                  {achat.mission.titre}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {achat.mission.profit ? (
                  <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>
                    {achat.mission.profit}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => handleValider(achat.id)}
                  disabled={validating === achat.id}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#1D9E75',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    opacity: validating === achat.id ? 0.5 : 1,
                  }}
                >
                  {validating === achat.id ? '…' : '✓ Valider'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
