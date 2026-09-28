'use client'

import type { ActiveTopic, ForumTopic } from './types'

interface Props {
  topicsSens: ForumTopic[]
  selected: ActiveTopic
  onSelect: (topic: ActiveTopic) => void
}

function TopicButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-border last:border-0 transition-colors ${
        active ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </p>
  )
}

export default function TopicsList({ topicsSens, selected, onSelect }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <SectionLabel>Ressources et échanges</SectionLabel>
      {topicsSens.length === 0 && (
        <p className="px-4 pb-3 text-xs text-text-muted">Aucun.</p>
      )}
      {topicsSens.map((t) => (
        <TopicButton
          key={t.id}
          label={t.nom}
          active={selected.kind === 'sens' && selected.id === t.id}
          onClick={() => onSelect({ kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode })}
        />
      ))}

      <div className="border-t border-border" />

      <TopicButton
        label="Questions"
        active={selected.kind === 'questions'}
        onClick={() => onSelect({ kind: 'questions' })}
      />
    </div>
  )
}
