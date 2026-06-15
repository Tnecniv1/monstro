import { forwardRef } from 'react'

export interface RapportCardProps {
  problemesReussis: number
  minutesConcentration: number
  minutesConcentrationPrev: number
  scoreTotal: number
  scoreVariation: number
  feuillesFait: number
  feuillesEnCours: number
  feuillesNonFait: number
  note?: string | null
  /** Quand fourni, verrouille la largeur (px) + padding interne — pour la capture html-to-image. */
  captureWidth?: number
}

function Delta({ value }: { value: number }) {
  if (value === 0) return null
  const sign = value > 0 ? '+' : ''
  return (
    <span style={{ color: value >= 0 ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 600 }}>
      {sign}{value}
    </span>
  )
}

function Squares({ count }: { count: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 10px)',
        gap: 3,
        marginTop: count > 0 ? 8 : 0,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ width: 10, height: 10, background: 'white', borderRadius: 2 }} />
      ))}
    </div>
  )
}

const RapportCard = forwardRef<HTMLDivElement, RapportCardProps>(function RapportCard(
  {
    problemesReussis,
    minutesConcentration,
    minutesConcentrationPrev,
    scoreTotal,
    scoreVariation,
    feuillesFait,
    feuillesEnCours,
    feuillesNonFait,
    note,
    captureWidth,
  },
  ref,
) {
  const pct = (problemesReussis / 5000) * 100
  const pctStr =
    pct.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'

  const minutesDelta = minutesConcentration - minutesConcentrationPrev

  const rootStyle: React.CSSProperties = captureWidth
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: `${captureWidth}px`,
        minWidth: `${captureWidth}px`,
        maxWidth: `${captureWidth}px`,
        boxSizing: 'border-box',
        background: '#F5F3EE',
        padding: '40px 48px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }

  return (
    <div ref={ref} style={rootStyle}>
      {/* Cartes stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        {/* Problèmes réussi */}
        <div style={{ background: '#0a0a0a', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Problèmes réussi
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
            {problemesReussis}
          </div>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, marginTop: 5 }}>
            {pctStr}
          </div>
        </div>

        {/* Minutes */}
        <div style={{ background: '#0a0a0a', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Minutes
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
            {minutesConcentration}
          </div>
          <div style={{ marginTop: 5, minHeight: 18 }}>
            <Delta value={minutesDelta} />
          </div>
        </div>

        {/* Score */}
        <div style={{ background: '#0a0a0a', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Score
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
            {scoreTotal}
          </div>
          <div style={{ marginTop: 5, minHeight: 18 }}>
            <Delta value={scoreVariation} />
          </div>
        </div>
      </div>

      {/* Cartes feuilles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        <div style={{ background: '#dcfce7', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Faites
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#166534', lineHeight: 1, marginTop: 4 }}>
            {feuillesFait}
          </div>
          <Squares count={feuillesFait} />
        </div>
        <div style={{ background: '#fef3c7', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            En cours
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#92400e', lineHeight: 1, marginTop: 4 }}>
            {feuillesEnCours}
          </div>
          <Squares count={feuillesEnCours} />
        </div>
        <div style={{ background: '#e7e5e0', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#57534e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            À faire
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#57534e', lineHeight: 1, marginTop: 4 }}>
            {feuillesNonFait}
          </div>
          <Squares count={feuillesNonFait} />
        </div>
      </div>

      {/* Note */}
      {note && (
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Note
          </div>
          <p style={{ fontSize: 13, color: '#1a1a1a', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {note}
          </p>
        </div>
      )}
    </div>
  )
})

export default RapportCard
