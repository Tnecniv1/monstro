'use client'

import { useEffect, useMemo, useState } from 'react'

// Port exact du mulberry32 de BigPixel.tsx
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// cols * rows = end - start (rectangle exact)
const LEVELS = [
  { name: 'Niveau 1',  cols: 10, rows:  5, color: '#6C5CE7', start:    0, end:    50 },
  { name: 'Niveau 2',  cols: 10, rows: 10, color: '#FFD93D', start:   50, end:   150 },
  { name: 'Niveau 3',  cols: 15, rows: 10, color: '#4DB7FF', start:  150, end:   300 },
  { name: 'Niveau 4',  cols: 20, rows: 10, color: '#00D084', start:  300, end:   500 },
  { name: 'Niveau 5',  cols: 20, rows: 15, color: '#FF6B35', start:  500, end:   800 },
  { name: 'Niveau 6',  cols: 20, rows: 20, color: '#FF006E', start:  800, end:  1200 },
  { name: 'Niveau 7',  cols: 40, rows: 20, color: '#00F5FF', start: 1200, end:  2000 },
  { name: 'Niveau 8',  cols: 40, rows: 25, color: '#EF233C', start: 2000, end:  3000 },
  { name: 'Niveau 9',  cols: 50, rows: 30, color: '#D90368', start: 3000, end:  4500 },
  { name: 'Niveau 10', cols: 50, rows: 30, color: '#8AFF8A', start: 4500, end:  6000 },
  { name: 'Niveau 11', cols: 50, rows: 40, color: '#FB5607', start: 6000, end:  8000 },
  { name: 'Niveau 12', cols: 50, rows: 40, color: '#1A1F3A', start: 8000, end: 10000 },
]

const TOTAL_MAX = 10000
const DISPLAY_WIDTH = 280
const GAP = 1
const SEED = 1337

function getLevelInfo(count: number) {
  const capped = Math.min(Math.max(count, 0), TOTAL_MAX)
  const idx = LEVELS.findIndex((l) => capped < l.end)
  const levelIdx = idx === -1 ? LEVELS.length - 1 : idx
  const level = LEVELS[levelIdx]
  const scoreInLevel = capped - level.start
  const capacity = level.cols * level.rows // = level.end - level.start
  return { levelIdx, level, scoreInLevel, capacity, pixelsLit: scoreInLevel, totalCount: capped }
}

interface Props {
  count: number
}

export default function PixelGrid({ count }: Props) {
  const { levelIdx, level, pixelsLit, totalCount } = useMemo(
    () => getLevelInfo(count),
    [count],
  )

  // Fisher-Yates seedé (même algo que BigPixel.tsx)
  const shuffledPositions = useMemo(() => {
    const rng = mulberry32(SEED)
    const arr: [number, number][] = []
    for (let r = 0; r < level.rows; r++)
      for (let c = 0; c < level.cols; c++)
        arr.push([r, c])
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [level.cols, level.rows])

  // Animation mount : révèle les pixels en ~1s via batches à 16ms
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    if (pixelsLit === 0) return
    const batchSize = Math.max(1, Math.ceil(pixelsLit / 60))
    let current = 0
    const id = setInterval(() => {
      current = Math.min(current + batchSize, pixelsLit)
      setRevealed(current)
      if (current >= pixelsLit) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [pixelsLit])

  // SVG dimensions (même logique que BigPixel : size / cols)
  const cellSize = (DISPLAY_WIDTH - GAP * (level.cols - 1)) / level.cols
  const svgHeight = level.rows * cellSize + GAP * (level.rows - 1)
  const litPositions = shuffledPositions.slice(0, revealed)

  return (
    <div className="space-y-3">

      {/* Grille SVG — fond blanc + contour subtil, comme BigPixel */}
      <div className="flex justify-center">
        <svg
          width={DISPLAY_WIDTH}
          height={svgHeight}
          style={{ border: '1px solid #E5E7EB', background: '#FFFFFF', display: 'block' }}
        >
          {litPositions.map(([r, c], i) => (
            <rect
              key={i}
              x={c * (cellSize + GAP)}
              y={r * (cellSize + GAP)}
              width={cellSize}
              height={cellSize}
              fill={level.color}
            />
          ))}
        </svg>
      </div>

      {/* Textes de progression */}
      <div className="text-center space-y-0.5">
        <p className="text-sm font-medium text-gray-700">
          Niveau {levelIdx + 1} / 12 ({Math.round(totalCount / TOTAL_MAX * 100)}%)
        </p>
        <p className="text-sm text-gray-400">
          {totalCount.toLocaleString('fr-FR')} succès
        </p>
      </div>
    </div>
  )
}
