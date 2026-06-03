import { MissionType } from '../types'

const config: Record<MissionType, { label: string; icon: string; style: React.CSSProperties }> = {
  argent: {
    label: 'Argent',
    icon: '💵',
    style: { background: '#D1FAE5', color: '#065F46' },
  },
  sagesse: {
    label: 'Sagesse',
    icon: '🪷',
    style: { background: '#FCE7F3', color: '#9D174D' },
  },
  preuve: {
    label: 'Preuve',
    icon: '🧨',
    style: { background: '#FEE2E2', color: '#991B1B' },
  },
}

export function MissionTypeBadge({ type }: { type: MissionType }) {
  const { label, icon, style } = config[type]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        width: 'fit-content',
        ...style,
      }}
    >
      <span>{icon}</span>
      {label}
    </span>
  )
}
