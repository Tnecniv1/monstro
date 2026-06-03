'use client'

import { Mission } from '../types'
import { MissionTypeBadge } from './MissionTypeBadge'

interface MissionCardProps {
  mission: Mission
  soldeCredits: number
  achetee: boolean
  onAcheter: (mission: Mission) => void
}

export function MissionCard({ mission, soldeCredits, achetee, onAcheter }: MissionCardProps) {
  const locked = achetee || soldeCredits < mission.cout_credits

  return (
    <div
      onClick={() => !locked && onAcheter(mission)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        borderRadius: 12, padding: '1rem 1.25rem',
        border: '0.5px solid rgba(0,0,0,0.08)',
        background: locked ? '#EDEAE3' : '#fff',
        opacity: locked ? 0.45 : 1,
        filter: locked ? 'grayscale(40%)' : 'none',
        cursor: locked ? 'default' : 'pointer',
        userSelect: locked ? 'none' : 'auto',
        transition: 'border-color 0.15s',
      }}
    >
      <MissionTypeBadge type={mission.type} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.3 }}>
          {mission.titre}
        </p>
        {mission.description && (
          <p style={{ fontSize: 12, color: '#888780', marginTop: 4, lineHeight: 1.5 }}>
            {mission.description}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: 'auto' }}>
        <span style={{ fontSize: 12, color: '#888780', display: 'flex', alignItems: 'center', gap: 4 }}>
          ◈ {mission.cout_credits.toLocaleString('fr-FR')} T
        </span>
        {mission.profit && (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#1D9E75' }}>
            {mission.profit}
          </span>
        )}
      </div>
    </div>
  )
}
