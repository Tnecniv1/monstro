'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ETAPES_PARCOURS } from './etapes'
import { chargerTicketsAction, marquerActionFaiteAction, type TicketSuivi, type TypeTicket } from './ticketsActions'

const FRICTION: Record<TypeTicket, string> = {
  question: 'Question sans réponse',
  bloque_init: "Bloqué à l'initialisation",
  inactif: 'Inactif',
  irregulier: 'Irrégulier',
}

const ETAT_LABEL: Record<TicketSuivi['etat'], string> = {
  a_faire: 'À faire',
  action_faite: 'Action faite',
}

const ETAT_STYLE: Record<TicketSuivi['etat'], string> = {
  a_faire: 'bg-accent/10 text-accent',
  action_faite: 'bg-success/15 text-success',
}

function action(t: TicketSuivi): string {
  switch (t.type) {
    case 'question':
      return 'Répondre à la question'
    case 'bloque_init':
      return `Proposer de l'aide — objectif : ${ETAPES_PARCOURS[(t.etape_bloquee ?? 1) - 1]}`
    case 'inactif':
      return "Contacter l'élève, fixer un objectif simple et précis"
    case 'irregulier':
      return 'Contacter un observateur, fixer un objectif simple et précis'
  }
}

function nomAffiche(t: TicketSuivi): string {
  if (!t.eleve) return '—'
  return [t.eleve.prenom, t.eleve.nom].filter(Boolean).join(' ') || t.eleve.pseudo
}

function ouvertDepuis(iso: string): string {
  const heures = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 3_600_000))
  if (heures < 1) return '< 1 h'
  return heures < 24 ? `${heures} h` : `${Math.floor(heures / 24)} j`
}

// « À faire » d'abord, puis « Action faite » ; du plus ancien au plus récent.
function comparer(a: TicketSuivi, b: TicketSuivi): number {
  if (a.etat !== b.etat) return a.etat === 'a_faire' ? -1 : 1
  return Date.parse(a.ouvert_le) - Date.parse(b.ouvert_le)
}

// Monté à l'ouverture de l'onglet Tickets : c'est ce montage qui déclenche le
// recalcul des tickets, puis leur chargement.
export default function TicketsView() {
  const [tickets, setTickets] = useState<TicketSuivi[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)

  useEffect(() => {
    let actif = true
    chargerTicketsAction()
      .then((r) => {
        if (!actif) return
        setErreur(r.erreur)
        setTickets(r.tickets)
      })
      .catch((e) => {
        if (!actif) return
        setErreur(e instanceof Error ? e.message : String(e))
        setTickets([])
      })
    return () => {
      actif = false
    }
  }, [])

  async function marquerFait(id: string) {
    setEnCours(id)
    const { erreur } = await marquerActionFaiteAction(id)
    setEnCours(null)
    if (erreur) {
      setErreur(erreur)
      return
    }
    setTickets((prev) => prev && prev.map((t) => (t.id === id ? { ...t, etat: 'action_faite' } : t)))
  }

  if (tickets == null) {
    return (
      <section className="rounded-2xl border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 font-semibold text-text-primary">Tickets</h2>
        <ul className="divide-y divide-border animate-pulse">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-4 flex-1 rounded bg-surface-2" />
              <span className="h-4 w-20 rounded bg-surface-2" />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const tries = tickets.slice().sort(comparer)

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 font-semibold text-text-primary">Tickets ({tries.length})</h2>

      {erreur && <p className="px-4 py-3 text-sm text-danger">Impossible de mettre à jour les tickets : {erreur}</p>}

      {tries.length === 0 ? (
        !erreur && <p className="px-4 py-8 text-center text-sm text-text-muted">Aucun ticket</p>
      ) : (
        <>
          <div className="hidden items-center gap-x-4 px-4 pt-3 text-[11px] uppercase tracking-wide text-text-muted sm:flex">
            <span className="w-40 shrink-0">Élève</span>
            <span className="w-44 shrink-0">Friction</span>
            <span className="min-w-0 flex-1">Action</span>
            <span className="w-24 shrink-0">État</span>
            <span className="w-16 shrink-0 text-right">Ouvert depuis</span>
            <span className="w-14 shrink-0" />
          </div>
          <ul className="divide-y divide-border">
            {tries.map((t) => (
              <Ligne key={t.id} ticket={t} enCours={enCours === t.id} onFait={() => marquerFait(t.id)} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Ligne({ ticket, enCours, onFait }: { ticket: TicketSuivi; enCours: boolean; onFait: () => void }) {
  const contenu = (
    <>
      <span className="w-full truncate font-medium text-text-primary sm:w-40 sm:shrink-0">{nomAffiche(ticket)}</span>
      <span className="w-full min-w-0 sm:w-44 sm:shrink-0">
        <span className="block text-text-primary">{FRICTION[ticket.type]}</span>
        {ticket.question && <span className="block truncate text-xs text-text-muted">{ticket.question.titre}</span>}
      </span>
      <span className="w-full min-w-0 text-text-secondary sm:w-auto sm:flex-1">{action(ticket)}</span>
    </>
  )
  const zone = 'flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 sm:flex-nowrap'

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
      {ticket.question_id ? (
        // Question sans réponse : la ligne mène à la question.
        <Link href={`/forum?ticket=${ticket.question_id}`} className={`${zone} rounded-lg transition-opacity hover:opacity-80`}>
          {contenu}
        </Link>
      ) : (
        <div className={zone}>{contenu}</div>
      )}
      <span className="w-24 shrink-0">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ETAT_STYLE[ticket.etat]}`}>{ETAT_LABEL[ticket.etat]}</span>
      </span>
      <span className="ml-auto w-16 shrink-0 text-right tabular-nums text-text-muted sm:ml-0">{ouvertDepuis(ticket.ouvert_le)}</span>
      <span className="w-14 shrink-0 text-right">
        {ticket.etat === 'a_faire' && (
          <button
            type="button"
            onClick={onFait}
            disabled={enCours}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
          >
            Fait
          </button>
        )}
      </span>
    </li>
  )
}
