'use client'

import type { ReactNode } from 'react'

export const GRID_CONTAINER_CLASS = 'grid grid-cols-2 sm:grid-cols-3 gap-3'

interface Props {
  onClick: () => void
  backgroundColor: string
  borderColor: string
  opacity?: number
  borderWidth?: number
  textClassName?: string
  children: ReactNode
}

export default function GridTile({
  onClick,
  backgroundColor,
  borderColor,
  opacity = 1,
  borderWidth = 2,
  textClassName = 'text-gray-900',
  children,
}: Props) {
  return (
    <button
      onClick={onClick}
      style={{ backgroundColor, border: `${borderWidth}px solid ${borderColor}`, opacity }}
      className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-3 text-center transition-opacity ${textClassName}`}
    >
      {children}
    </button>
  )
}
