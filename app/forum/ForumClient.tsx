'use client'

import { useState } from 'react'
import ScriptsRow from './ScriptsRow'
import ScriptPdfModal from './ScriptPdfModal'
import TopicsList from './TopicsList'
import TicketsPanel from './TicketsPanel'
import type { ActiveTopic, FeuilleTopic, ForumCardItem, ForumResource, ForumScript, ForumTopic } from './types'

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
  // Un seul état de modal PDF, partagé entre la bande de fiches (en haut)
  // et le panneau Ressources (à la place des tickets) — ScriptPdfModal ne
  // dépend que de { titre, pdf_url }, donc ForumScript et ForumResource
  // conviennent tous les deux sans cast (cf. ForumCardItem/PdfPreviewItem).
  const [openPdfItem, setOpenPdfItem] = useState<ForumCardItem | null>(null)
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

      <ScriptsRow items={scripts} onSelect={setOpenPdfItem} />

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
              onSelect={setOpenPdfItem}
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

      {openPdfItem && <ScriptPdfModal script={openPdfItem} onClose={() => setOpenPdfItem(null)} />}
    </div>
  )
}
