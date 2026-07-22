import { forwardRef } from 'react'

export interface RapportCardProps {
  problemesTravailles: number
  problemesTravaillesPrev: number
  minutesConcentration: number
  minutesConcentrationPrev: number
  tauxReussite: number
  tauxReussitePrev: number
  problemesReussis: number
  note?: string | null
  /** Quand fourni, verrouille la largeur (px) + padding interne — pour la capture html-to-image. */
  captureWidth?: number
}

const OBJECTIF_EXERCICES = 5000
const GRID_COLS = 50
const GRID_ROWS = 100

function formatPctChange(delta: number, prevValue: number): string {
  const pct = (delta / prevValue) * 100
  const sign = pct >= 0 ? '+' : '-'
  const abs = Math.abs(pct).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${sign}${abs}%`
}

function Delta({
  value,
  prevValue,
  suffix = '',
  fontSize = 12,
}: {
  value: number
  prevValue?: number | null
  suffix?: string
  fontSize?: number
}) {
  if (value === 0) return null
  const sign = value > 0 ? '+' : ''
  const color = value >= 0 ? '#4ade80' : '#f87171'
  const pctStr = prevValue ? formatPctChange(value, prevValue) : null
  return (
    <span style={{ color, fontSize, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {sign}{value}{suffix}
      {pctStr && <span style={{ fontSize: fontSize * 0.75 }}> ({pctStr})</span>}
    </span>
  )
}

function ProgressionGrid({ problemesReussis, legendFontSize = 11 }: { problemesReussis: number; legendFontSize?: number }) {
  const filled = Math.max(0, Math.min(problemesReussis, OBJECTIF_EXERCICES))
  const cells: JSX.Element[] = []

  for (let i = 0; i < OBJECTIF_EXERCICES; i++) {
    const col = i % GRID_COLS
    const row = Math.floor(i / GRID_COLS)
    cells.push(
      <rect
        key={i}
        x={col + 0.075}
        y={row + 0.075}
        width={0.85}
        height={0.85}
        fill={i < filled ? '#a78bfa' : '#e2e0da'}
      />,
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: legendFontSize, color: '#6b7280', marginBottom: 6 }}>
        {problemesReussis} / {OBJECTIF_EXERCICES} exercices réussis
      </div>
      <svg
        viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
        width="100%"
        style={{ display: 'block' }}
      >
        {cells}
      </svg>
    </div>
  )
}

const RapportCard = forwardRef<HTMLDivElement, RapportCardProps>(function RapportCard(
  {
    problemesTravailles,
    problemesTravaillesPrev,
    minutesConcentration,
    minutesConcentrationPrev,
    tauxReussite,
    tauxReussitePrev,
    problemesReussis,
    note,
    captureWidth,
  },
  ref,
) {
  const problemesTravaillesDelta = problemesTravailles - problemesTravaillesPrev
  const minutesDelta = minutesConcentration - minutesConcentrationPrev
  const tauxReussiteDelta = tauxReussite - tauxReussitePrev

  const isCapture = !!captureWidth

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
        padding: '48px 48px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }

  const cardLabelSize = isCapture ? 20 : 10
  const cardNumberSize = isCapture ? 64 : 28
  const cardDeltaSize = isCapture ? 24 : 12
  const cardPadding = isCapture ? '28px 24px' : '14px 16px'
  const cardRadius = isCapture ? 20 : 12
  const cardsGap = isCapture ? 16 : 10
  const legendSize = isCapture ? 22 : 11
  const noteLabelSize = isCapture ? 20 : 10
  const noteTextSize = isCapture ? 26 : 13

  return (
    <div ref={ref} style={rootStyle}>
      {/* Cartes stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: cardsGap, width: '100%' }}>
        {/* Problèmes travaillés */}
        <div style={{ background: '#0a0a0a', borderRadius: cardRadius, padding: cardPadding }}>
          <div style={{ fontSize: cardLabelSize, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, whiteSpace: 'nowrap' }}>
            Expérience
          </div>
          <div style={{ fontSize: cardNumberSize, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
            {problemesTravailles}
          </div>
          <div style={{ marginTop: 5, minHeight: 18 }}>
            <Delta value={problemesTravaillesDelta} prevValue={problemesTravaillesPrev} fontSize={cardDeltaSize} />
          </div>
        </div>

        {/* Minutes */}
        <div style={{ background: '#0a0a0a', borderRadius: cardRadius, padding: cardPadding }}>
          <div style={{ fontSize: cardLabelSize, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, whiteSpace: 'nowrap' }}>
            Temps
          </div>
          <div style={{ fontSize: cardNumberSize, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
            {minutesConcentration}
          </div>
          <div style={{ marginTop: 5, minHeight: 18 }}>
            <Delta value={minutesDelta} prevValue={minutesConcentrationPrev} fontSize={cardDeltaSize} />
          </div>
        </div>

        {/* Taux de réussite */}
        <div style={{ background: '#0a0a0a', borderRadius: cardRadius, padding: cardPadding }}>
          <div style={{ fontSize: cardLabelSize, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, whiteSpace: 'nowrap' }}>
            Succès
          </div>
          <div style={{ fontSize: cardNumberSize, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
            {tauxReussite}%
          </div>
          <div style={{ marginTop: 5, minHeight: 18 }}>
            <Delta value={tauxReussiteDelta} prevValue={tauxReussitePrev} suffix=" pts" fontSize={cardDeltaSize} />
          </div>
        </div>
      </div>

      {/* Grille de progression */}
      <div style={{ background: '#F5F3EE', borderRadius: 12, padding: '14px 16px' }}>
        <ProgressionGrid problemesReussis={problemesReussis} legendFontSize={legendSize} />
      </div>

      {/* Note */}
      {note && (
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: noteLabelSize, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Note
          </div>
          <p style={{ fontSize: noteTextSize, color: '#1a1a1a', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {note}
          </p>
        </div>
      )}
    </div>
  )
})

export default RapportCard
