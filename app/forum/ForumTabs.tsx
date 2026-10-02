'use client'

import type { ActiveTopic, ForumTopic } from './types'

interface Props {
  topicsSens: ForumTopic[]
  selected: ActiveTopic
  onSelect: (topic: ActiveTopic) => void
}

// Barre d'onglets sous les scripts : les topics "de sens" dans l'ordre de
// forum_topics (Philosophie, Ressources…), puis Questions.
export default function ForumTabs({ topicsSens, selected, onSelect }: Props) {
  const onglets: { key: string; label: string; active: boolean; topic: ActiveTopic }[] = [
    ...topicsSens.map((t) => ({
      key: t.id,
      label: t.nom,
      active: selected.kind === 'sens' && selected.id === t.id,
      topic: { kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode } as ActiveTopic,
    })),
    { key: 'questions', label: 'Questions', active: selected.kind === 'questions', topic: { kind: 'questions' } },
  ]

  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {onglets.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={o.active}
          onClick={() => onSelect(o.topic)}
          className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            o.active
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
