'use client'

export default function StreakBadge({ streak, pixels }: { streak: number; pixels: number }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="text-text-primary" style={{ fontSize: 20, fontWeight: 600 }}>
        {pixels.toLocaleString('fr-FR')}{' '}
        <span className="inline-flex items-center align-middle">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="8" rx="1.5" className="fill-accent" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" className="fill-accent" opacity="0.55" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" className="fill-accent" opacity="0.55" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" className="fill-accent" />
          </svg>
        </span>
      </span>
      <span className="text-text-primary" style={{ fontSize: 20, fontWeight: 600 }}>
        {streak > 0 ? (
          <>
            {streak}{' '}
            <span className="inline-flex items-center align-middle text-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3 L18 3 L18 6 L12 12 L18 18 L18 21 L6 21 L6 18 L12 12 L6 6 Z" />
              </svg>
            </span>
          </>
        ) : ''}
      </span>
    </div>
  )
}
