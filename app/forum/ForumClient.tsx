'use client'

import { useState } from 'react'
import ScriptsRow from './ScriptsRow'
import ScriptPdfModal from './ScriptPdfModal'
import TopicsList from './TopicsList'
import TicketsPanel from './TicketsPanel'
import type { ActiveTopic, FeuilleTopic, ForumScript, ForumTopic } from './types'

interface Props {
  scripts: ForumScript[]
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
  topicsSens,
  allFeuilles,
  focusIds,
  initialPinnedIds,
  ticketFeuilleIds,
  userId,
  isAdmin,
}: Props) {
  const [openScript, setOpenScript] = useState<ForumScript | null>(null)
  const [activeTopic, setActiveTopic] = useState<ActiveTopic | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  function selectTopic(topic: ActiveTopic) {
    setActiveTopic((prev) => (prev?.kind === topic.kind && prev.id === topic.id ? prev : topic))
    setSelectedTicketId(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Forum</h1>

      <ScriptsRow scripts={scripts} onSelect={setOpenScript} />

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

        <TicketsPanel
          key={activeTopic ? `${activeTopic.kind}:${activeTopic.id}` : 'none'}
          activeTopic={activeTopic}
          userId={userId}
          isAdmin={isAdmin}
          selectedTicketId={selectedTicketId}
          onSelectTicket={setSelectedTicketId}
        />
      </div>

      {openScript && <ScriptPdfModal script={openScript} onClose={() => setOpenScript(null)} />}
    </div>
  )
}
