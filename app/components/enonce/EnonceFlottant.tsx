'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { ExerciceEnCours } from '@/lib/exerciceEnCours'

// Panneau et pdf.js chargés seulement quand l'élève ouvre l'énoncé : rien de
// plus à télécharger pour l'accueil.
const PanneauEnonce = dynamic(() => import('./PanneauEnonce'), { ssr: false })

// Énoncé flottant (accueil et /entrainement) : pastille au-dessus de la barre
// d'onglets tant qu'un exercice est en cours (lib/exerciceEnCours.ts) ;
// toucher l'ouvre en panneau Énoncé | Correction. Rien sans exercice en cours.
export default function EnonceFlottant({ exercice }: { exercice: ExerciceEnCours | null }) {
  const [ouvert, setOuvert] = useState(false)
  if (!exercice) return null

  return (
    <>
      {/* Réserve la place de la pastille en bas du contenu. */}
      <div aria-hidden className="h-[72px]" />

      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={`Exercice ${exercice.exo}, ${exercice.titre} : lire l’énoncé`}
          className="fixed inset-x-4 z-40 flex h-14 items-center gap-3 rounded-2xl px-2 text-left shadow-[0_8px_24px_rgba(31,18,53,0.35)] md:inset-x-auto md:right-4 md:w-[360px]"
          style={{ background: '#1F1235', bottom: 'calc(56px + env(safe-area-inset-bottom) + 16px)' }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: '#6D28D9' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">Exercice {exercice.exo}</span>
            <span className="block truncate text-xs" style={{ color: '#C4B5FD' }}>
              {exercice.titre} · toucher pour lire
            </span>
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </span>
        </button>
      )}

      {ouvert && <PanneauEnonce exercice={exercice} onFermer={() => setOuvert(false)} />}
    </>
  )
}
