'use client'

import { formatHeure, formatJourDate } from './relativeTime'
import type { LiveSession } from './types'

interface Props {
  session: LiveSession
  busy: boolean
  onModifier: () => void
  onSupprimer: () => void
  onClose: () => void
}

// Modal admin : détail d'une session (lien, inscrits) et actions.
export default function EquipeDetailModal({ session, busy, onModifier, onSupprimer, onClose }: Props) {
  const inscrits = session.inscrits ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-text-primary">{formatJourDate(session.debut)}</h2>
            <p className="text-sm text-text-secondary">
              {formatHeure(session.debut)} · {session.duree_minutes} min · avec {session.animateur_nom}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-muted hover:text-text-secondary transition-colors text-2xl leading-none p-2 -mr-2"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto text-sm">
          <div className="space-y-1">
            <p className="font-medium text-text-secondary">Lien</p>
            {session.lien && (
              <a
                href={session.lien}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-accent hover:underline"
              >
                {session.lien}
              </a>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-medium text-text-secondary">
              Inscrits ({inscrits.length} / {session.places})
            </p>
            {inscrits.length > 0 ? (
              <ul className="text-text-primary">
                {inscrits.map((i, index) => (
                  <li key={index}>{[i.prenom, i.nom].filter(Boolean).join(' ') || i.pseudo || '—'}</li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted">Aucun inscrit.</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onSupprimer}
            disabled={busy}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-danger hover:bg-surface-2 disabled:opacity-50 transition-colors"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={onModifier}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Modifier
          </button>
        </div>
      </div>
    </div>
  )
}
