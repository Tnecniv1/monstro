'use client'

import MathText from '../components/MathText'
import type { ForumScript } from './types'

interface Props {
  script: ForumScript
  onClose: () => void
}

// Même overlay/header/fermer que ScriptPdfModal (dupliqué volontairement —
// ScriptPdfModal reste inchangé, toujours utilisé tel quel par les
// ressources). Pas de "Télécharger"/"Plein écran" ici : contenu texte, pas
// de PDF à manipuler.
export default function ScriptTextModal({ script, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-surface rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border shrink-0 bg-surface">
          <h2 className="font-semibold text-text-primary truncate">{`#${script.ordre} ${script.titre}`}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-muted hover:text-text-secondary transition-colors text-2xl leading-none p-2 -mr-1"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {script.citation && (
            <>
              <blockquote className="border-l-2 border-border-strong pl-4 italic text-text-secondary">
                <MathText text={script.citation} />
              </blockquote>
              <hr className="border-border" />
            </>
          )}

          {script.etapes.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune étape pour l&apos;instant.</p>
          ) : (
            <div className="space-y-4">
              {script.etapes.map((etape, i) => (
                <div key={i}>
                  <p className="text-sm font-bold text-text-primary">
                    <span className="text-accent">{`E_${i + 1} `}</span>
                    <MathText text={etape.titre} />
                  </p>
                  <div className="text-sm text-text-primary mt-1 leading-relaxed">
                    <MathText text={etape.description} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
