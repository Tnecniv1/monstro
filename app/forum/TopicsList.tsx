'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PickerFeuilleModal from './PickerFeuilleModal'
import type { ActiveTopic, FeuilleTopic, ForumTopic } from './types'

interface Props {
  topicsSens: ForumTopic[]
  allFeuilles: FeuilleTopic[]
  focusIds: string[]
  initialPinnedIds: string[]
  ticketFeuilleIds: string[]
  userId: string
  selected: ActiveTopic | null
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

export default function TopicsList({
  topicsSens,
  allFeuilles,
  focusIds,
  initialPinnedIds,
  ticketFeuilleIds,
  userId,
  selected,
  onSelect,
}: Props) {
  const supabase = createClient()

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set(initialPinnedIds))
  const [showPicker, setShowPicker] = useState(false)

  // Focus ∪ épingles ∪ feuilles avec ticket existant de l'utilisateur,
  // dédoublonnées — mêmes feuilles que allFeuilles donc déjà triées
  // alphabétiquement. (Array.from plutôt que [...set] : la cible TS du
  // projet n'active pas downlevelIteration pour l'itération de Set.)
  const visibleFeuilles = useMemo(() => {
    const ids = new Set([...focusIds, ...ticketFeuilleIds, ...Array.from(pinnedIds)])
    return allFeuilles.filter((f) => ids.has(f.id))
  }, [allFeuilles, focusIds, ticketFeuilleIds, pinnedIds])

  const pickerOptions = useMemo(() => {
    const shown = new Set([...focusIds, ...ticketFeuilleIds, ...Array.from(pinnedIds)])
    return allFeuilles.filter((f) => !shown.has(f.id))
  }, [allFeuilles, focusIds, ticketFeuilleIds, pinnedIds])

  async function pin(feuille: FeuilleTopic) {
    setPinnedIds((prev) => new Set(prev).add(feuille.id))
    setShowPicker(false)
    const { error } = await supabase.from('forum_topic_pins').insert({ user_id: userId, feuille_id: feuille.id })
    if (error) {
      // Rollback de la mise à jour optimiste si l'insertion échoue côté serveur.
      setPinnedIds((prev) => {
        const next = new Set(prev)
        next.delete(feuille.id)
        return next
      })
    }
  }

  async function unpin(feuilleId: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      next.delete(feuilleId)
      return next
    })
    const { error } = await supabase
      .from('forum_topic_pins')
      .delete()
      .eq('user_id', userId)
      .eq('feuille_id', feuilleId)
    if (error) {
      setPinnedIds((prev) => new Set(prev).add(feuilleId))
    }
  }

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
          active={selected?.kind === 'sens' && selected.id === t.id}
          onClick={() => onSelect({ kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode })}
        />
      ))}

      <div className="border-t border-border" />

      <SectionLabel>Feuilles de travail</SectionLabel>
      {visibleFeuilles.length === 0 && (
        <p className="px-4 pb-2 text-xs text-text-muted">
          Mets une feuille en Focus ou épingle-la pour la voir ici.
        </p>
      )}
      {visibleFeuilles.map((f) => {
        const active = selected?.kind === 'feuille' && selected.id === f.id
        const removable = pinnedIds.has(f.id)
        return (
          <div
            key={f.id}
            className={`group flex items-center border-b border-border last:border-0 transition-colors ${
              active ? 'bg-accent/10' : 'hover:bg-surface-2'
            }`}
          >
            <button
              onClick={() => onSelect({ kind: 'feuille', id: f.id, nom: f.titre })}
              className={`flex-1 min-w-0 text-left px-4 py-3 text-sm font-medium truncate ${
                active ? 'text-accent' : 'text-text-primary'
              }`}
            >
              {f.titre}
            </button>
            {removable && (
              <button
                onClick={(e) => { e.stopPropagation(); unpin(f.id) }}
                aria-label={`Retirer ${f.titre} des épingles`}
                title="Retirer"
                className="shrink-0 px-3 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity"
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      <button
        onClick={() => setShowPicker(true)}
        className="w-full text-left px-4 py-3 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-accent transition-colors"
      >
        + Épingler une feuille
      </button>

      {showPicker && (
        <PickerFeuilleModal
          options={pickerOptions}
          onClose={() => setShowPicker(false)}
          onPick={pin}
        />
      )}
    </div>
  )
}
