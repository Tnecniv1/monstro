'use client'

export default function StreakBadge({ streak }: { streak: number }) {
  const MAX_DOTS = 30
  const filled = Math.min(streak, MAX_DOTS)

  return (
    <div className="w-full space-y-2">
      <p className="text-center text-sm font-medium text-gray-700">
        {streak > 0 ? `🔥 ${streak} jour${streak > 1 ? 's' : ''}` : 'Pas de streak'}
      </p>
      <div className="flex gap-[3px]">
        {Array.from({ length: MAX_DOTS }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[7px] rounded-[1px]"
            style={{ backgroundColor: i < filled ? '#6C5CE7' : '#DDD8F5' }}
          />
        ))}
      </div>
    </div>
  )
}
