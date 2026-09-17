'use client'

import { useState } from 'react'
import ScriptsRow from './ScriptsRow'
import ScriptTextModal from './ScriptTextModal'
import ScriptPdfModal from './ScriptPdfModal'
import TopicsList from './TopicsList'
import TicketsPanel from './TicketsPanel'
import type { ActiveTopic, FeuilleTopic, ForumResource, ForumScript, ForumTopic } from './types'

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

  function selectTopic(topic: ActiveTopic) {
    setActiveTopic((prev) => (prev?.kind === topic.kind && prev.id === topic.id ? prev : topic))
    setSelectedTicketId(null)
  }

  const showResources = activeTopic?.kind === 'sens' && activeTopic.displayMode === 'resources'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Forum</h1>

      <ScriptsRow items={scripts} onSelect={setOpenScript} />

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
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
          />
        )}
      </div>

      {openScript && <ScriptTextModal script={openScript} onClose={() => setOpenScript(null)} />}
      {openResource && <ScriptPdfModal script={openResource} onClose={() => setOpenResource(null)} />}
    </div>
  )
}
