'use client'

import QcmTab from './QcmTab'

export type Niveau = { niveau: number; nom: string }

interface Props {
  userId: string
  niveaux: Niveau[]
}

export default function ApprendreClient({ userId, niveaux }: Props) {
  return <QcmTab userId={userId} niveaux={niveaux} />
}
