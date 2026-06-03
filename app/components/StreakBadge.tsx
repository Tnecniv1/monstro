'use client'

export default function StreakBadge({ streak, pixels }: { streak: number; pixels: number }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>
        {pixels.toLocaleString('fr-FR')} ◈
      </span>
      <span style={{ fontSize: 13, fontWeight: 400, color: '#888780', opacity: 0.75 }}>
        {streak > 0 ? `🔥 ${streak}` : ''}
      </span>
    </div>
  )
}
