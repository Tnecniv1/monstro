'use client'

import MathText from '../components/MathText'
import { AVANT_SCRIPT1, ERREUR_ENREGISTREMENT } from '../onboarding/texts'

interface Props {
  saving: boolean
  error: boolean
  onOk: () => void
}

// Modal 3 de l'onboarding — affiché avant la toute première ouverture du
// Script 1 (ordre = 1). Pas de fermeture autre que "Ok".
export default function AvantScript1Modal({ saving, error, onOk }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm bg-surface rounded-2xl shadow-xl p-6 space-y-4"
      >
        <div className="text-sm text-text-primary leading-relaxed">
          <MathText text={AVANT_SCRIPT1.texte} />
        </div>
        {error && <p className="text-sm text-danger">{ERREUR_ENREGISTREMENT}</p>}
        <button
          onClick={onOk}
          disabled={saving}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Enregistrement…' : AVANT_SCRIPT1.bouton}
        </button>
      </div>
    </div>
  )
}
