'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPseudoMap } from './profiles'
import { formatRelative } from './relativeTime'
import NouveauTicketModal from './NouveauTicketModal'
import TicketDetail from './TicketDetail'
import type { ActiveTopic, ForumTicket } from './types'

const STATUT_STYLE: Record<string, string> = {
  ouvert: 'bg-accent/10 text-accent',
  resolu: 'bg-success/15 text-success',
  ferme: 'bg-surface-2 text-text-muted',
}

function statutBadgeClass(statut: string): string {
  return STATUT_STYLE[statut] ?? 'bg-surface-2 text-text-secondary'
}

interface Props {
  activeTopic: ActiveTopic | null
  userId: string
  isAdmin: boolean
  selectedTicketId: string | null
  onSelectTicket: (id: string | null) => void
}

export default function TicketsPanel({ activeTopic, userId, isAdmin, selectedTicketId, onSelectTicket }: Props) {
  const supabase = createClient()

  const [tickets, setTickets] = useState<ForumTicket[]>([])
  const [pseudos, setPseudos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!activeTopic) {
      setTickets([])
      return
    }

    let cancelled = false
    setLoading(true)

    const column = activeTopic.kind === 'sens' ? 'topic_id' : 'feuille_id'

    supabase
      .from('forum_tickets')
      .select('id, topic_id, feuille_id, user_id, titre, statut, created_at')
      .eq(column, activeTopic.id)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as ForumTicket[]
        setTickets(rows)
        setPseudos(await fetchPseudoMap(supabase, rows.map((t) => t.user_id)))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic?.kind, activeTopic?.id])

  function handleCreated(ticket: ForumTicket) {
    setTickets((prev) => [ticket, ...prev])
    setPseudos((prev) => new Map(prev).set(ticket.user_id, prev.get(ticket.user_id) ?? '—'))
    setShowModal(false)
    onSelectTicket(ticket.id)
  }

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null

  if (!activeTopic) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">Choisis un topic à gauche pour voir ses tickets.</p>
      </div>
    )
  }

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        authorPseudo={pseudos.get(selectedTicket.user_id) ?? '—'}
        userId={userId}
        onBack={() => onSelectTicket(null)}
      />
    )
  }

  // Topic "de sens" : la RLS ne permet l'insertion sur topic_id qu'au compte
  // admin (auth.uid() exact côté DB) — le bouton est masqué (pas juste
  // désactivé) pour tout le monde sauf role='admin' (cf. adminGate.ts :
  // seule notion d'admin dans l'app, en supposant que ce rôle correspond
  // bien au compte visé par la RLS).
  const canCreateTicket = activeTopic.kind === 'feuille' || isAdmin

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-text-primary">{activeTopic.nom}</h2>
        {canCreateTicket && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Nouveau ticket
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-text-muted py-8 text-center">Chargement…</p>}

      {!loading && tickets.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            {canCreateTicket
              ? <>Aucun ticket pour l&apos;instant. Sois le premier à en ouvrir un !</>
              : <>Aucun ticket pour l&apos;instant.</>}
          </p>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTicket(t.id)}
              className="w-full text-left rounded-xl border border-border bg-surface p-4 space-y-1 hover:border-border-strong transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-text-primary truncate">{t.titre}</p>
                {t.statut && (
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statutBadgeClass(t.statut)}`}>
                    {t.statut}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted">
                {pseudos.get(t.user_id) ?? '—'} · {formatRelative(t.created_at)}
              </p>
            </button>
          ))}
        </div>
      )}

      {showModal && canCreateTicket && (
        <NouveauTicketModal
          activeTopic={activeTopic}
          userId={userId}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
