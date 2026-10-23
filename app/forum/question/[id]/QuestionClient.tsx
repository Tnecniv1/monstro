'use client'

import { useRouter } from 'next/navigation'
import { FilQuestion, useFilQuestions } from '../../FilQuestions'
import { SUJET_LABEL, TICKET_COLUMNS } from '../../types'

export default function QuestionClient({
  ticketId,
  userId,
  isAdmin,
}: {
  ticketId: string
  userId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const fil = useFilQuestions({
    userId,
    isAdmin,
    cle: ticketId,
    chargerTickets: (supabase) => supabase.from('forum_tickets').select(TICKET_COLUMNS).eq('id', ticketId),
  })
  const ticket = fil.tickets[0]

  if (fil.loading) return <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>
  if (!ticket) {
    return (
      <p className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
        Cette question n&apos;existe plus.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        {ticket.sujet && (
          <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs font-medium text-text-secondary">
            {SUJET_LABEL[ticket.sujet]}
          </span>
        )}
        <h1 className="text-xl font-bold text-text-primary">{ticket.titre}</h1>
      </div>
      <FilQuestion ticket={ticket} fil={fil} userId={userId} isAdmin={isAdmin} onSupprimee={() => router.push('/forum')} />
    </div>
  )
}
