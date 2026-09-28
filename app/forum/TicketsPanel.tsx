'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPseudoMap } from './profiles'
import { formatRelative } from './relativeTime'
import NouveauTicketModal from './NouveauTicketModal'
import TicketDetail from './TicketDetail'
import { STATUT_STYLE, questionReference } from './questionMeta'
import { STATUT_LABEL, SUJET_LABEL, TICKET_COLUMNS } from './types'
import type { ActiveTopic, Feuille, ForumScript, ForumTicket, QuestionSujet, TicketStatut } from './types'

const SELECT_CLASS =
  'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'

interface Props {
  activeTopic: ActiveTopic
  userId: string
  isAdmin: boolean
  hasOpenTicket: boolean
  feuilles: Feuille[]
  focusIds: string[]
  scripts: ForumScript[]
  selectedTicketId: string | null
  onSelectTicket: (id: string | null) => void
  onTicketsChanged?: () => void
}

export default function TicketsPanel({
  activeTopic,
  userId,
  isAdmin,
  hasOpenTicket,
  feuilles,
  focusIds,
  scripts,
  selectedTicketId,
  onSelectTicket,
  onTicketsChanged,
}: Props) {
  const supabase = createClient()
  const isQuestions = activeTopic.kind === 'questions'

  const [tickets, setTickets] = useState<ForumTicket[]>([])
  const [pseudos, setPseudos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Filtres des questions — côté client, non persistés (remis à zéro quand
  // on change de topic, TicketsPanel étant remonté via sa key).
  const [filtreSujet, setFiltreSujet] = useState<QuestionSujet | 'tous'>('tous')
  const [filtreFeuille, setFiltreFeuille] = useState<string>('toutes')
  const [filtreStatut, setFiltreStatut] = useState<TicketStatut | 'tous'>('tous')
  const [mesQuestions, setMesQuestions] = useState(false)

  const topicId = activeTopic.kind === 'sens' ? activeTopic.id : null

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const base = supabase.from('forum_tickets').select(TICKET_COLUMNS)
    const query = topicId ? base.eq('topic_id', topicId) : base.is('topic_id', null)

    query.order('created_at', { ascending: false }).then(async ({ data }) => {
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
  }, [topicId])

  const feuilleById = useMemo(() => new Map(feuilles.map((f) => [f.id, f])), [feuilles])
  const scriptById = useMemo(() => new Map(scripts.map((s) => [s.id, s])), [scripts])
  const feuillesFocus = useMemo(
    () => feuilles.filter((f) => focusIds.includes(f.id)),
    [feuilles, focusIds]
  )

  // Épinglées toujours visibles (ignorent les filtres) et en tête, puis
  // created_at décroissant (ordre de la requête, conservé par le tri stable).
  const visibleTickets = useMemo(() => {
    if (!isQuestions) return tickets
    return tickets
      .filter(
        (t) =>
          t.epingle ||
          ((filtreSujet === 'tous' || t.sujet === filtreSujet) &&
            (filtreSujet !== 'probleme' || filtreFeuille === 'toutes' || t.feuille_id === filtreFeuille) &&
            (filtreStatut === 'tous' || t.statut === filtreStatut) &&
            (!mesQuestions || t.user_id === userId))
      )
      .sort((a, b) => Number(b.epingle) - Number(a.epingle))
  }, [isQuestions, tickets, filtreSujet, filtreFeuille, filtreStatut, mesQuestions, userId])

  function changeSujet(value: QuestionSujet | 'tous') {
    setFiltreSujet(value)
    setFiltreFeuille('toutes')
  }

  function handleCreated(ticket: ForumTicket) {
    setTickets((prev) => [ticket, ...prev])
    setShowModal(false)
    onSelectTicket(ticket.id)
    onTicketsChanged?.()
    // Premier ticket de l'auteur dans cette liste : son pseudo n'a pas encore
    // été chargé — on le récupère au lieu d'afficher "—".
    if (!pseudos.has(ticket.user_id)) {
      fetchPseudoMap(supabase, [ticket.user_id]).then((map) => {
        setPseudos((prev) => new Map(prev).set(ticket.user_id, map.get(ticket.user_id) ?? '—'))
      })
    }
  }

  // Résolution / épinglage depuis TicketDetail : la liste se met à jour sans
  // rechargement (visibleTickets recalcule l'ordre, épinglées en tête).
  function handleTicketUpdated(ticketId: string, patch: Partial<Pick<ForumTicket, 'statut' | 'epingle'>>) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)))
    onTicketsChanged?.()
  }

  function handleTicketDeleted(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    onSelectTicket(null)
    onTicketsChanged?.()
  }

  // Cherché dans la liste complète (pas filtrée) : "Ton ticket en cours"
  // doit s'ouvrir même s'il est masqué par un filtre.
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        authorPseudo={pseudos.get(selectedTicket.user_id) ?? '—'}
        userId={userId}
        isAdmin={isAdmin}
        feuilleById={feuilleById}
        scriptById={scriptById}
        onBack={() => onSelectTicket(null)}
        onUpdated={(patch) => handleTicketUpdated(selectedTicket.id, patch)}
        onDeleted={() => handleTicketDeleted(selectedTicket.id)}
      />
    )
  }

  // Topic "de sens" : la RLS ne permet l'insertion sur topic_id qu'au compte
  // admin (auth.uid() exact côté DB) — le bouton est masqué (pas juste
  // désactivé) pour tout le monde sauf role='admin' (cf. adminGate.ts :
  // seule notion d'admin dans l'app, en supposant que ce rôle correspond
  // bien au compte visé par la RLS).
  // Questions : un non-admin avec déjà un ticket ouvert (tous topics
  // confondus, cf. trigger forum_enforce_one_open_ticket) ne peut pas en
  // ouvrir un second — évite le clic pour rien, le trigger bloquerait de
  // toute façon l'insertion côté DB.
  const canCreateTicket = isAdmin || (isQuestions && !hasOpenTicket)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-text-primary">
          {activeTopic.kind === 'sens' ? activeTopic.nom : 'Questions'}
        </h2>
        {canCreateTicket && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {isQuestions ? '+ Question' : 'Nouveau ticket'}
          </button>
        )}
      </div>

      {isQuestions && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtreSujet}
            onChange={(e) => changeSujet(e.target.value as QuestionSujet | 'tous')}
            aria-label="Sujet"
            className={SELECT_CLASS}
          >
            <option value="tous">Tous les sujets</option>
            {(Object.keys(SUJET_LABEL) as QuestionSujet[]).map((s) => (
              <option key={s} value={s}>{SUJET_LABEL[s]}</option>
            ))}
          </select>

          {filtreSujet === 'probleme' && (
            <select
              value={filtreFeuille}
              onChange={(e) => setFiltreFeuille(e.target.value)}
              aria-label="Feuille"
              className={SELECT_CLASS}
            >
              <option value="toutes">Toutes les feuilles</option>
              {feuillesFocus.map((f) => (
                <option key={f.id} value={f.id}>{f.titre}</option>
              ))}
            </select>
          )}

          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as TicketStatut | 'tous')}
            aria-label="Statut"
            className={SELECT_CLASS}
          >
            <option value="tous">Tous les statuts</option>
            <option value="ouvert">{STATUT_LABEL.ouvert}</option>
            <option value="ferme">{STATUT_LABEL.ferme}</option>
          </select>

          <button
            type="button"
            onClick={() => setMesQuestions((v) => !v)}
            aria-pressed={mesQuestions}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mesQuestions
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-secondary hover:bg-surface-2'
            }`}
          >
            Mes questions
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-text-muted py-8 text-center">Chargement…</p>}

      {!loading && visibleTickets.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            {isQuestions && tickets.length > 0
              ? <>Aucune question ne correspond à ces filtres.</>
              : canCreateTicket
                ? <>Aucun ticket pour l&apos;instant. Sois le premier à en ouvrir un !</>
                : <>Aucun ticket pour l&apos;instant.</>}
          </p>
        </div>
      )}

      {!loading && visibleTickets.length > 0 && (
        <div className="space-y-2">
          {visibleTickets.map((t) => {
            const ref = isQuestions ? questionReference(t, feuilleById, scriptById) : null
            return (
              <button
                key={t.id}
                onClick={() => onSelectTicket(t.id)}
                className="w-full text-left rounded-xl border border-border bg-surface p-4 space-y-1 hover:border-border-strong transition-colors"
              >
                {isQuestions && (t.sujet || ref || t.epingle) && (
                  <div className="flex items-center gap-2 min-w-0 text-xs">
                    {t.epingle && <span title="Épinglée" aria-label="Épinglée">📌</span>}
                    {t.sujet && (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-medium text-text-secondary">
                        {SUJET_LABEL[t.sujet]}
                      </span>
                    )}
                    {ref && <span className="truncate text-text-muted">{ref}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-text-primary truncate">{t.titre}</p>
                  {t.statut && (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUT_STYLE[t.statut] ?? 'bg-surface-2 text-text-secondary'}`}>
                      {STATUT_LABEL[t.statut] ?? t.statut}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  {pseudos.get(t.user_id) ?? '—'} · {formatRelative(t.created_at)}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {showModal && canCreateTicket && (
        <NouveauTicketModal
          activeTopic={activeTopic}
          userId={userId}
          feuilles={feuilles}
          focusIds={focusIds}
          scripts={scripts}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
