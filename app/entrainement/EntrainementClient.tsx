'use client'

import { useState } from 'react'
import NouvelEntrainementButton from './NouvelEntrainementButton'
import NouvelEntrainementModal from './NouvelEntrainementModal'

export default function EntrainementClient({
  userId,
  enCours,
}: {
  userId: string
  enCours: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <NouvelEntrainementButton
        disabled={enCours}
        onOpen={() => setModalOpen(true)}
      />
      {modalOpen && (
        <NouvelEntrainementModal
          userId={userId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
