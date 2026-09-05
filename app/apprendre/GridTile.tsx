'use client'

import type { ReactNode } from 'react'

export const GRID_CONTAINER_CLASS = 'grid grid-cols-2 sm:grid-cols-3 gap-3'

export type EtatTuile = 'verrouille' | 'disponible' | 'terminee'

const STYLES_ETAT: Record<EtatTuile, { classe: string; opacity: number }> = {
  verrouille: { classe: 'bg-surface border-2 border-border', opacity: 0.55 },
  disponible: { classe: 'bg-surface border-[3px] border-accent', opacity: 1 },
  terminee: { classe: 'bg-surface border-2 border-success', opacity: 1 },
}

interface Props {
  onClick: () => void
  etat: EtatTuile
  textClassName?: string
  children: ReactNode
}

export default function GridTile({ onClick, etat, textClassName = 'text-text-primary', children }: Props) {
  const { classe, opacity } = STYLES_ETAT[etat]

  return (
    <button
      onClick={onClick}
      style={{ opacity }}
      className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-3 text-center transition-opacity ${classe} ${textClassName}`}
    >
      {etat === 'terminee' && (
        <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-success text-bg">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5l10 -10" />
          </svg>
        </span>
      )}
      {children}
    </button>
  )
}
