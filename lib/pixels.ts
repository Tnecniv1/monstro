// Niveaux de la PixelGrid : calculs purs, sans 'use client', utilisables
// depuis un composant serveur (légende de la carte parcours) comme depuis
// PixelGrid (composant client).

// cols * rows = end - start (rectangle exact)
export const LEVELS = [
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

export const TOTAL_MAX = 10000

export function getLevelInfo(count: number) {
  const capped = Math.min(Math.max(count, 0), TOTAL_MAX)
  const idx = LEVELS.findIndex((l) => capped < l.end)
  const levelIdx = idx === -1 ? LEVELS.length - 1 : idx
  const level = LEVELS[levelIdx]
  const scoreInLevel = capped - level.start
  const capacity = level.cols * level.rows // = level.end - level.start
  return { levelIdx, level, scoreInLevel, capacity, pixelsLit: scoreInLevel, totalCount: capped }
}

// Numéro du niveau (1 à 12) pour un nombre de pixels : légende de la carte parcours.
export function niveauPixels(count: number) {
  return getLevelInfo(count).levelIdx + 1
}
