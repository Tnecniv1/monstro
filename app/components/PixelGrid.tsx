'use client'

import { useEffect, useMemo, useState } from 'react'
import { getLevelInfo, TOTAL_MAX } from '@/lib/pixels'

// Port exact du mulberry32 de BigPixel.tsx
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DISPLAY_WIDTH = 280
const GAP = 1
const SEED = 1337

interface Props {
  count: number
  // Vrai : la grille prend toute la largeur de son conteneur (viewBox mis à
  // l'échelle) au lieu des 280px fixes. Utilisé dans la carte parcours.
  pleineLargeur?: boolean
  // Vrai : pas de fond gris derrière la grille (cases vides transparentes,
  // seuls les pixels allumés restent visibles). Utilisé dans la carte parcours.
  fondTransparent?: boolean
  // Vrai : la grille prend l'espace restant (flex-1) et tient dans la largeur
  // ET la hauteur disponibles (viewBox « meet » : taille = min des deux),
  // centrée ; sans fond ni légende (affichée par la carte parcours).
  ajuster?: boolean
}

export default function PixelGrid({ count, pleineLargeur = false, fondTransparent = false, ajuster = false }: Props) {
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

  const cases = litPositions.map(([r, c], i) => (
    <rect
      key={i}
      x={c * (cellSize + GAP)}
      y={r * (cellSize + GAP)}
      width={cellSize}
      height={cellSize}
      className="fill-accent"
    />
  ))

  // Mode ajuster : 120 px au minimum (en deçà, l'accueil défile).
  if (ajuster) {
    return (
      <div className="relative min-h-[120px] flex-1">
        <svg
          viewBox={`0 0 ${DISPLAY_WIDTH} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
        >
          {cases}
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Grille SVG — fond blanc + contour subtil, comme BigPixel */}
      <div className="flex justify-center">
        <svg
          width={pleineLargeur ? '100%' : DISPLAY_WIDTH}
          height={pleineLargeur ? undefined : svgHeight}
          viewBox={pleineLargeur ? `0 0 ${DISPLAY_WIDTH} ${svgHeight}` : undefined}
          className={fondTransparent ? undefined : 'bg-surface-2'}
          style={{ display: 'block' }}
        >
          {cases}
        </svg>
      </div>

      {/* Textes de progression */}
      <div className="text-center">
        <p className="text-sm font-medium text-text-secondary">
          Niveau {levelIdx + 1} / 12 ({Math.round(totalCount / TOTAL_MAX * 100)}%)
        </p>
      </div>
    </div>
  )
}
