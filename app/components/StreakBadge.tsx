'use client'

export default function StreakBadge({ streak }: { streak: number }) {
  return (
    <div className="text-center text-sm text-gray-500">
      {streak > 0 ? `🔥 ${streak} jour${streak > 1 ? 's' : ''}` : 'Pas de streak'}
    </div>
  )
}
