'use client'

import type { ForumOnglet, ForumTopic } from './types'
import PastilleCompteur from '../components/PastilleCompteur'

interface Props {
  topicsSens: ForumTopic[]
  selected: ForumOnglet
  onSelect: (onglet: ForumOnglet) => void
  // Questions en attente (pastille de l'onglet Problèmes, masquée à 0).
  compteurQuestions: number
}

// Barre d'onglets : Scripts, puis les topics "de sens" dans l'ordre de
// forum_topics (sans les TOPICS_MASQUES ni le topic Ressources, filtrés par la page),
// puis Problèmes (questions du forum) et Équipe.
export default function ForumTabs({ topicsSens, selected, onSelect, compteurQuestions }: Props) {
  const onglets: { key: string; label: string; active: boolean; topic: ForumOnglet; badge?: number }[] = [
    { key: 'scripts', label: 'Scripts', active: selected.kind === 'scripts', topic: { kind: 'scripts' } },
    ...topicsSens.map((t) => ({
      key: t.id,
      label: t.nom,
      active: selected.kind === 'sens' && selected.id === t.id,
      topic: { kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode } as ForumOnglet,
    })),
    { key: 'questions', label: 'Problèmes', active: selected.kind === 'questions', topic: { kind: 'questions' }, badge: compteurQuestions },
    { key: 'equipe', label: 'Équipe', active: selected.kind === 'equipe', topic: { kind: 'equipe' } },
  ]

  // Contrôle segmenté : piste grise, onglet actif en carte blanche. La piste
  // défile horizontalement si l'écran est trop étroit (axe vertical masqué :
  // la pastille tient dans le padding de l'onglet).
  return (
    <div
      role="tablist"
      className="flex max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-xl bg-surface-2 p-1"
    >
      {onglets.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={o.active}
          onClick={() => onSelect(o.topic)}
          className={`shrink-0 rounded-[9px] border px-[18px] py-2.5 text-sm transition-colors ${
            o.active
              ? 'border-border bg-surface font-bold text-accent'
              : 'border-transparent font-semibold text-text-primary hover:bg-surface/60'
          }`}
        >
          {/* Pastille dans le padding du bouton : la piste (overflow-x-auto)
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
