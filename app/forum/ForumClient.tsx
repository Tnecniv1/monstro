'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ScriptsRow from './ScriptsRow'
import ScriptTextModal from './ScriptTextModal'
import ScriptPdfModal from './ScriptPdfModal'
import TopicsList from './TopicsList'
import TicketsPanel from './TicketsPanel'
import { TICKET_COLUMNS } from './types'
import type { ActiveTopic, Feuille, ForumResource, ForumScript, ForumTicket, ForumTopic } from './types'

interface Props {
  scripts: ForumScript[]
  resources: ForumResource[]
  topicsSens: ForumTopic[]
  feuilles: Feuille[]
  focusIds: string[]
  userId: string
  isAdmin: boolean
}

export default function ForumClient({
  scripts,
  resources,
  topicsSens,
  feuilles,
  focusIds,
  userId,
  isAdmin,
}: Props) {
  // Scripts (citation + étapes) et ressources (PDF) ouvrent deux modals
  // différents — ScriptPdfModal reste inchangé, dédié aux ressources.
  const [openScript, setOpenScript] = useState<ForumScript | null>(null)
  const [openResource, setOpenResource] = useState<ForumResource | null>(null)
  // Le panneau Questions est actif par défaut à l'ouverture de la page.
  const [activeTopic, setActiveTopic] = useState<ActiveTopic>({ kind: 'questions' })
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
      .select(TICKET_COLUMNS)
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
    setActiveTopic((prev) => (sameTopic(prev, topic) ? prev : topic))
    setSelectedTicketId(null)
  }

  function openMonTicket() {
    if (!monTicket) return
    if (monTicket.topic_id) {
      const t = topicsSens.find((x) => x.id === monTicket.topic_id)
      if (t) setActiveTopic({ kind: 'sens', id: t.id, nom: t.nom, displayMode: t.display_mode })
    } else {
      setActiveTopic((prev) => (prev.kind === 'questions' ? prev : { kind: 'questions' }))
    }
    setSelectedTicketId(monTicket.id)
  }

  const showResources = activeTopic.kind === 'sens' && activeTopic.displayMode === 'resources'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Forum</h1>
        {isAdmin && (
          <Link
            href="/forum/suivi"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
          >
            Suivi
          </Link>
        )}
      </div>

      <ScriptsRow items={scripts} onSelect={setOpenScript} showNumber />

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
        <TopicsList topicsSens={topicsSens} selected={activeTopic} onSelect={selectTopic} />

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
            key={activeTopic.kind === 'sens' ? `sens:${activeTopic.id}` : 'questions'}
            activeTopic={activeTopic}
            userId={userId}
            isAdmin={isAdmin}
            hasOpenTicket={!!monTicket}
            feuilles={feuilles}
            focusIds={focusIds}
            scripts={scripts}
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

function sameTopic(a: ActiveTopic, b: ActiveTopic): boolean {
  if (a.kind === 'questions' || b.kind === 'questions') return a.kind === b.kind
  return a.id === b.id
}
