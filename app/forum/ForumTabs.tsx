'use client'

import type { ForumOnglet, ForumTopic } from './types'
import PastilleCompteur from '../components/PastilleCompteur'

interface Props {
  topicsSens: ForumTopic[]
  selected: ForumOnglet
  onSelect: (onglet: ForumOnglet) => void
  // Questions en attente (pastille de l'onglet Questions, masquée à 0).
  compteurQuestions: number
}

// Barre d'onglets : Scripts, puis les topics "de sens" dans l'ordre de
// forum_topics (Philosophie, Ressources…), puis Questions et Équipe.
export default function ForumTabs({ topicsSens, selected, onSelect, compteurQuestions }: Props) {
  const onglets: { key: string; label: string; active: boolean; topic: ForumOnglet; badge?: number }[] = [
    { key: 'scripts', label: 'Scripts', active: selected.kind === 'scripts', topic: { kind: 'scripts' } },
    ...topicsSens.map((t) => ({
      key: t.id,
      label: t.nom,
      active: selected.kind === 'sens' && selected.id === t.id,
      topic: { kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode } as ForumOnglet,
    })),
    { key: 'questions', label: 'Questions', active: selected.kind === 'questions', topic: { kind: 'questions' }, badge: compteurQuestions },
    { key: 'equipe', label: 'Équipe', active: selected.kind === 'equipe', topic: { kind: 'equipe' } },
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
          {/* Pastille dans le padding du bouton : la barre (overflow-x-auto)
              rognerait tout ce qui en déborde. */}
          <span className="relative">
            {o.label}
            {o.badge != null && <PastilleCompteur count={o.badge} className="absolute -right-3.5 -top-2" />}
          </span>
        </button>
      ))}
    </div>
  )
}
