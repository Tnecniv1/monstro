'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ScriptsRow from './ScriptsRow'
import ScriptTextModal from './ScriptTextModal'
import ScriptPdfModal from './ScriptPdfModal'
import TopicsList from './TopicsList'
import TicketsPanel from './TicketsPanel'
import type { ActiveTopic, FeuilleTopic, ForumResource, ForumScript, ForumTicket, ForumTopic } from './types'

interface Props {
  scripts: ForumScript[]
  resources: ForumResource[]
  topicsSens: ForumTopic[]
  allFeuilles: FeuilleTopic[]
  focusIds: string[]
  initialPinnedIds: string[]
  ticketFeuilleIds: string[]
  userId: string
  isAdmin: boolean
}

export default function ForumClient({
  scripts,
  resources,
  topicsSens,
  allFeuilles,
  focusIds,
  initialPinnedIds,
  ticketFeuilleIds,
  userId,
  isAdmin,
}: Props) {
  // Scripts (citation + étapes) et ressources (PDF) ouvrent deux modals
  // différents — ScriptPdfModal reste inchangé, dédié aux ressources.
  const [openScript, setOpenScript] = useState<ForumScript | null>(null)
  const [openResource, setOpenResource] = useState<ForumResource | null>(null)
  const [activeTopic, setActiveTopic] = useState<ActiveTopic | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  // "Mon ticket en cours" — accès rapide toujours visible, indépendant du
  // topic actif. Un non-admin ne peut en avoir qu'un (trigger DB), mais on
  // ne prend que le plus récent dans tous les cas.
  const [monTicket, setMonTicket] = useState<ForumTicket | null>(null)
  const [monTicketVersion, setMonTicketVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('forum_tickets')
      .select('id, topic_id, feuille_id, user_id, titre, statut, created_at')
      .eq('user_id', userId)
      .neq('statut', 'ferme')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setMonTicket(((data ?? [])[0] as ForumTicket) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [userId, monTicketVersion])

  function refreshMonTicket() {
    setMonTicketVersion((v) => v + 1)
  }

  function selectTopic(topic: ActiveTopic) {
    setActiveTopic((prev) => (prev?.kind === topic.kind && prev.id === topic.id ? prev : topic))
    setSelectedTicketId(null)
  }

  function openMonTicket() {
    if (!monTicket) return
    if (monTicket.topic_id) {
      const t = topicsSens.find((x) => x.id === monTicket.topic_id)
      if (t) setActiveTopic({ kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode })
    } else if (monTicket.feuille_id) {
      const f = allFeuilles.find((x) => x.id === monTicket.feuille_id)
      if (f) setActiveTopic({ kind: 'feuille', id: f.id, nom: f.titre })
    }
    setSelectedTicketId(monTicket.id)
  }

  const showResources = activeTopic?.kind === 'sens' && activeTopic.displayMode === 'resources'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Forum</h1>

      <ScriptsRow items={scripts} onSelect={setOpenScript} />

      {monTicket && (
        <button
          onClick={openMonTicket}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-left hover:bg-accent/10 transition-colors"
        >
          <span className="text-sm text-text-primary truncate">
            <span className="font-medium">Ton ticket en cours</span> — {monTicket.titre}
          </span>
          <span className="text-xs font-medium text-accent shrink-0">Ouvrir →</span>
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-start">
        <TopicsList
          topicsSens={topicsSens}
          allFeuilles={allFeuilles}
          focusIds={focusIds}
          initialPinnedIds={initialPinnedIds}
          ticketFeuilleIds={ticketFeuilleIds}
          userId={userId}
          selected={activeTopic}
          onSelect={selectTopic}
        />

        {showResources ? (
          <div className="space-y-3">
            <h2 className="font-semibold text-text-primary">{activeTopic.nom}</h2>
            <ScriptsRow
              items={resources}
              onSelect={setOpenResource}
              variant="grid"
              emptyMessage="Aucune ressource pour l'instant."
            />
          </div>
        ) : (
          <TicketsPanel
            key={activeTopic ? `${activeTopic.kind}:${activeTopic.id}` : 'none'}
            activeTopic={activeTopic}
            userId={userId}
            isAdmin={isAdmin}
            hasOpenTicket={!!monTicket}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
            onTicketsChanged={refreshMonTicket}
          />
        )}
      </div>

      {openScript && <ScriptTextModal script={openScript} onClose={() => setOpenScript(null)} />}
      {openResource && <ScriptPdfModal script={openResource} onClose={() => setOpenResource(null)} />}
    </div>
  )
}
