import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import { isForumAdmin } from '../../adminGate'
import { problemeHref } from '../../types'
import type { ForumTicket } from '../../types'
import QuestionClient from './QuestionClient'

// Page d'une question de la FAQ : Méthode, Application, ou question Problème
// sans numéro. Même fil que la page d'un problème ; retour vers la FAQ.
export default async function QuestionPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()

  const { user, profile } = await getUser()
  const { data } = await createClient()
    .from('forum_tickets')
    .select('id, topic_id, sujet, feuille_id, numero_exercice')
    .eq('id', params.id)
    .maybeSingle()
  const ticket = data as Pick<ForumTicket, 'id' | 'topic_id' | 'sujet' | 'feuille_id' | 'numero_exercice'> | null
  if (!ticket) notFound()

  // Ticket d'un topic de sens : affiché dans son onglet, comme avant.
  if (ticket.topic_id != null) redirect(`/forum?ticket=${ticket.id}`)
  // Question Problème numérotée : sa place est sur la page du problème.
  if (ticket.sujet === 'probleme' && ticket.feuille_id && ticket.numero_exercice != null) {
    redirect(problemeHref(ticket.feuille_id, ticket.numero_exercice))
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[760px] space-y-5 px-4 py-5">
        <Link
          href="/forum/faq"
          className="-ml-2 inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          ‹ Retour au forum
        </Link>

        <QuestionClient ticketId={ticket.id} userId={user.id} isAdmin={isForumAdmin(profile?.role)} />
      </div>
    </div>
  )
}
