import { forwardRef } from 'react'

export interface RapportCardProps {
  problemesTravailles: number
  problemesTravaillesPrev: number
  minutesConcentration: number
  minutesConcentrationPrev: number
  tauxReussite: number
  tauxReussitePrev: number
  problemesReussis: number
  /** Lundi de la semaine du rapport ('YYYY-MM-DD'). Quand fourni, affiche l'en-tête logo + plage de dates. */
  lundi?: string
  /** Quand fourni, verrouille la largeur (px) + padding interne — pour la capture html-to-image. */
  captureWidth?: number
}

const OBJECTIF_EXERCICES = 1000
const GRID_COLS = 40
const GRID_ROWS = OBJECTIF_EXERCICES / GRID_COLS

// Palette du rapport (image envoyée aux parents)
const COLORS = {
  fond: '#FAFAFA',
  carte: '#FFFFFF',
  bordure: '#ECECEF',
  accent: '#6D28D9',
  encre: '#1E2233',
  label: '#8A8B9B',
  caseVide: '#EEEEF1',
  hausse: '#3E9B6A', // vert doux
  baisse: '#E07B5A', // corail doux
}

function formatPctChange(delta: number, prevValue: number): string {
  const pct = (delta / prevValue) * 100
  const sign = pct >= 0 ? '+' : '-'
  const abs = Math.abs(pct).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${sign}${abs}%`
}

// "15 – 21 sept." ou, à cheval sur deux mois, "29 sept. – 5 oct."
function formatPlageSemaine(lundi: string): string {
  const [y, m, d] = lundi.split('-').map(Number)
  const debut = new Date(y, m - 1, d)
  const fin = new Date(y, m - 1, d + 6)
  const mois = (date: Date) => date.toLocaleDateString('fr-FR', { month: 'short' })
  return debut.getMonth() === fin.getMonth()
    ? `${debut.getDate()} – ${fin.getDate()} ${mois(fin)}`
    : `${debut.getDate()} ${mois(debut)} – ${fin.getDate()} ${mois(fin)}`
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
  const color = value >= 0 ? COLORS.hausse : COLORS.baisse
  const pctStr = prevValue ? formatPctChange(value, prevValue) : null
  return (
    <span style={{ color, fontSize, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {sign}{value}{suffix}
      {pctStr && <span style={{ fontSize: fontSize * 0.75 }}> ({pctStr})</span>}
    </span>
  )
}

function ProgressionGrid({ problemesReussis, legendFontSize = 11 }: { problemesReussis: number; legendFontSize?: number }) {
  // Grille plafonnée à 1000 cases remplies ; le texte garde le vrai total.
  const filled = Math.max(0, Math.min(problemesReussis, OBJECTIF_EXERCICES))
  const cells: JSX.Element[] = []

  for (let i = 0; i < OBJECTIF_EXERCICES; i++) {
    const col = i % GRID_COLS
    const row = Math.floor(i / GRID_COLS)
    cells.push(
      <rect
        key={i}
        x={col + 0.1}
        y={row + 0.1}
        width={0.8}
        height={0.8}
        rx={0.18}
        fill={i < filled ? COLORS.accent : COLORS.caseVide}
      />,
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: legendFontSize, color: COLORS.label, marginBottom: 8 }}>
        <span style={{ color: COLORS.encre, fontWeight: 700 }}>{problemesReussis}</span> / {OBJECTIF_EXERCICES} exercices réussis
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
    lundi,
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
        gap: 16,
        width: `${captureWidth}px`,
        minWidth: `${captureWidth}px`,
        maxWidth: `${captureWidth}px`,
        boxSizing: 'border-box',
        background: COLORS.fond,
        padding: '48px 48px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }

  const logoSize = isCapture ? 56 : 24
  const brandSize = isCapture ? 30 : 14
  const dateSize = isCapture ? 24 : 12
  const cardLabelSize = isCapture ? 20 : 10
  const cardNumberSize = isCapture ? 64 : 28
  const cardDeltaSize = isCapture ? 24 : 12
  const cardPadding = isCapture ? '28px 24px' : '14px 16px'
  const cardRadius = isCapture ? 20 : 12
  const cardsGap = isCapture ? 16 : 10
  const gridPadding = isCapture ? '28px 28px' : '14px 16px'
  const legendSize = isCapture ? 22 : 11

  const carteStyle: React.CSSProperties = {
    background: COLORS.carte,
    border: `1px solid ${COLORS.bordure}`,
    borderRadius: cardRadius,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: cardLabelSize,
    color: COLORS.label,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    whiteSpace: 'nowrap',
  }
  const nombreStyle: React.CSSProperties = {
    fontSize: cardNumberSize,
    fontWeight: 800,
    color: COLORS.encre,
    lineHeight: 1,
  }

  const tuiles = [
    { label: 'Expériences', valeur: `${problemesTravailles}`, delta: problemesTravaillesDelta, prev: problemesTravaillesPrev, suffix: '' },
    { label: 'Temps', valeur: `${minutesConcentration}`, delta: minutesDelta, prev: minutesConcentrationPrev, suffix: '' },
    { label: 'Réussite', valeur: `${tauxReussite}%`, delta: tauxReussiteDelta, prev: tauxReussitePrev, suffix: ' pts' },
  ]

  return (
    <div ref={ref} style={rootStyle}>
      {/* En-tête : logo + nom + plage de dates de la semaine */}
      {lundi && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isCapture ? 12 : 6 }}>
            {/* logo.png a un fond blanc opaque : on l'assume dans une petite tuile blanche bordée */}
            <img
              src="/images/logo.png"
              alt=""
              width={logoSize}
              height={logoSize}
              style={{
                width: logoSize,
                height: logoSize,
                background: COLORS.carte,
                border: `1px solid ${COLORS.bordure}`,
                borderRadius: isCapture ? 14 : 6,
              }}
            />
            <span style={{ fontSize: brandSize, fontWeight: 800, color: COLORS.encre }}>Monstro</span>
          </div>
          <span style={{ fontSize: dateSize, fontWeight: 600, color: COLORS.label, whiteSpace: 'nowrap' }}>
            {formatPlageSemaine(lundi)}
          </span>
        </div>
      )}

      {/* Tuiles stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: cardsGap, width: '100%' }}>
        {tuiles.map((t) => (
          <div key={t.label} style={{ ...carteStyle, padding: cardPadding }}>
            <div style={labelStyle}>{t.label}</div>
            <div style={nombreStyle}>{t.valeur}</div>
            <div style={{ marginTop: 5, minHeight: 18 }}>
              <Delta value={t.delta} prevValue={t.prev} suffix={t.suffix} fontSize={cardDeltaSize} />
            </div>
          </div>
        ))}
      </div>

      {/* Grille de progression */}
      <div style={{ ...carteStyle, padding: gridPadding }}>
        <ProgressionGrid problemesReussis={problemesReussis} legendFontSize={legendSize} />
      </div>
    </div>
  )
})

export default RapportCard
