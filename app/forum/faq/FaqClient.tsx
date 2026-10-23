'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useForumAttente } from '../../components/ForumAttenteProvider'
import { PointAttente } from '../../components/PastilleCompteur'
import NouveauTicketModal from '../NouveauTicketModal'
import { fetchPseudoMap } from '../profiles'
import { STATUT_STYLE, questionReference } from '../questionMeta'
import { formatRelative } from '../relativeTime'
import { SUJET_LABEL, TICKET_COLUMNS, estQuestionFaq } from '../types'
import type { Feuille, ForumScript, ForumTicket, QuestionSujet } from '../types'

// Sujets proposés par « + Question » : les questions Problème se posent
// depuis la page du problème.
const SUJETS_FAQ: QuestionSujet[] = ['methode', 'application']

interface Props {
  userId: string
  isAdmin: boolean
  feuilles: Feuille[]
  focusIds: string[]
  scripts: ForumScript[]
}

export default function FaqClient({ userId, isAdmin, feuilles, focusIds, scripts }: Props) {
  const router = useRouter()
  const [tickets, setTickets] = useState<ForumTicket[] | null>(null)
  const [pseudos, setPseudos] = useState<Map<string, string>>(new Map())
  // Question ouverte de l'utilisateur, tous sujets confondus (trigger
  // forum_enforce_one_open_ticket) : « + Question » masqué, comme avant.
  const [aUneQuestionOuverte, setAUneQuestionOuverte] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('forum_tickets')
      .select(TICKET_COLUMNS)
      .is('topic_id', null)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const rows = ((data ?? []) as ForumTicket[]).filter(estQuestionFaq)
        const map = await fetchPseudoMap(supabase, rows.map((t) => t.user_id))
        if (cancelled) return
        setTickets(rows)
        setPseudos(map)
      })
    supabase
      .from('forum_tickets')
      .select('id')
      .eq('user_id', userId)
      .neq('statut', 'ferme')
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setAUneQuestionOuverte((data ?? []).length > 0)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const feuilleById = useMemo(() => new Map(feuilles.map((f) => [f.id, f])), [feuilles])
  const scriptById = useMemo(() => new Map(scripts.map((s) => [s.id, s])), [scripts])

  // Épinglées : Méthode et Application seulement. Toutes les autres : ouvertes
  // d'abord, puis de la plus récente à la plus ancienne (ordre de la requête,
  // conservé par le tri stable).
  const [epinglees, autres] = useMemo(() => {
    const liste = tickets ?? []
    const estEpinglee = (t: ForumTicket) => t.epingle && (t.sujet === 'methode' || t.sujet === 'application')
    return [
      liste.filter(estEpinglee),
      liste
        .filter((t) => !estEpinglee(t))
        .sort((a, b) => Number(b.statut !== 'ferme') - Number(a.statut !== 'ferme')),
    ]
  }, [tickets])

  const canCreateTicket = isAdmin || !aUneQuestionOuverte

  function liste(items: ForumTicket[]) {
    return (
      <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
        {items.map((t) => (
          <LigneQuestion
            key={t.id}
            ticket={t}
            auteur={pseudos.get(t.user_id) ?? '—'}
            reference={questionReference(t, feuilleById, scriptById)}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-primary">FAQ</h1>
        {canCreateTicket && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="min-h-[44px] shrink-0 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-text-secondary hover:bg-surface-2 transition-colors"
          >
            + Question
          </button>
        )}
      </div>

      {!tickets ? (
        <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          {epinglees.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary">Épinglées</h2>
              {liste(epinglees)}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-text-primary">Toutes les questions</h2>
            {autres.length === 0 ? (
              <p className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
                Aucune question pour l&apos;instant.
              </p>
            ) : (
              liste(autres)
            )}
          </section>
        </>
      )}

      {showModal && canCreateTicket && (
        <NouveauTicketModal
          activeTopic={{ kind: 'questions' }}
          userId={userId}
          feuilles={feuilles}
          focusIds={focusIds}
          scripts={scripts}
          sujets={SUJETS_FAQ}
          onClose={() => setShowModal(false)}
          onCreated={(ticket) => router.push(`/forum/question/${ticket.id}`)}
        />
      )}
    </div>
  )
}

// Une ligne de la FAQ (format des anciennes « Autres questions ») : sujet,
// titre, auteur · date · référence, point de non-lu, statut.
function LigneQuestion({ ticket: t, auteur, reference }: { ticket: ForumTicket; auteur: string; reference: string | null }) {
  const { ids: enAttente } = useForumAttente()
  return (
    <li>
      <Link
        href={`/forum/question/${t.id}`}
        className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            {t.sujet && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-text-secondary">
                {SUJET_LABEL[t.sujet]}
              </span>
            )}
            <span className="truncate text-sm font-medium text-text-primary">{t.titre}</span>
          </div>
          <p className="truncate text-xs text-text-muted">
            {auteur} · {formatRelative(t.created_at)}
            {reference ? ` · ${reference}` : ''}
          </p>
        </div>
        {enAttente.has(t.id) && <PointAttente />}
        {t.statut && (
          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${STATUT_STYLE[t.statut]}`}>
            {t.statut === 'ferme' ? 'Résolue' : 'Ouverte'}
          </span>
        )}
      </Link>
    </li>
  )
}
