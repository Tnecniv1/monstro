'use client'

import type { ForumScript } from './types'

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

interface Props {
  scripts: ForumScript[]
  onSelect: (script: ForumScript) => void
}

export default function ScriptsRow({ scripts, onSelect }: Props) {
  if (scripts.length === 0) {
    return <p className="text-sm text-text-muted">Aucune fiche disponible pour l&apos;instant.</p>
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
      {scripts.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className="shrink-0 w-56 text-left rounded-xl border border-border bg-surface p-4 space-y-2 hover:border-border-strong transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-text-secondary">
            <DocIcon />
          </div>
          <p className="font-semibold text-text-primary text-sm leading-snug line-clamp-2">{s.titre}</p>
          {s.description && (
            <p className="text-xs text-text-secondary line-clamp-2">{s.description}</p>
          )}
        </button>
      ))}
    </div>
  )
}
