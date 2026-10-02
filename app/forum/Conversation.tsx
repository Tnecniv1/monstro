'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Composer from './Composer'
import KebabMenu, { type KebabItem } from './KebabMenu'
import MessageList from './MessageList'
import { fetchPseudoMap } from './profiles'
import { STATUT_STYLE, questionReference } from './questionMeta'
import { STATUT_LABEL, SUJET_LABEL } from './types'
import type { Feuille, ForumMessage, ForumScript, ForumTicket } from './types'

// Le trigger sur forum_tickets refuse tout changement d'epingle par un
// non-admin (code P0001) — reformulé plutôt que d'afficher l'erreur brute.
function friendlyPinError(error: { code?: string; message: string }): string {
  if (error.code === 'P0001') return 'Seul un admin peut épingler ou désépingler une question.'
  return error.message
}

const MESSAGE_COLUMNS = 'id, ticket_id, user_id, contenu, image_url, created_at'

interface Props {
  ticket: ForumTicket
  userId: string
  isAdmin: boolean
  feuilleById: Map<string, Feuille>
  scriptById: Map<string, ForumScript>
  // Écran étroit : retour à la liste.
  onBack: () => void
  // Remonte la modification au panneau pour mettre à jour la liste.
  onUpdated: (patch: Partial<Pick<ForumTicket, 'statut' | 'epingle'>>) => void
  onDeleted: () => void
}

// Conversation d'un ticket, façon messagerie : en-tête fixe, messages qui
// défilent, barre de saisie fixée en bas. Occupe toute la hauteur de son
// parent (colonne droite, ou plein écran sur écran étroit).
export default function Conversation({
  ticket,
  userId,
  isAdmin,
  feuilleById,
  scriptById,
  onBack,
  onUpdated,
  onDeleted,
}: Props) {
  const supabase = createClient()

  const [messages, setMessages] = useState<ForumMessage[]>([])
  const [pseudos, setPseudos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [pinning, setPinning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingTicket, setDeletingTicket] = useState(false)

  const isAuthor = ticket.user_id === userId
  const isFerme = ticket.statut === 'ferme'
  const isQuestion = ticket.topic_id === null
  const canManageTicket = isAuthor || isAdmin
  const reference = isQuestion ? questionReference(ticket, feuilleById, scriptById) : null

  // .select('id') : une mise à jour filtrée par la RLS ne renvoie pas
  // d'erreur, juste 0 ligne — on le détecte pour ne pas afficher un faux succès.
  async function handleResolve() {
    setResolving(true)
    setActionError(null)
    const { data, error: resolveError } = await supabase
      .from('forum_tickets')
      .update({ statut: 'ferme' })
      .eq('id', ticket.id)
      .select('id')
    setResolving(false)
    if (resolveError) {
      setActionError(resolveError.message)
    } else if (!data || data.length === 0) {
      setActionError("Tu n'as pas le droit de fermer ce ticket.")
    } else {
      onUpdated({ statut: 'ferme' })
    }
  }

  async function handleTogglePin() {
    const epingle = !ticket.epingle
    setPinning(true)
    setActionError(null)
    const { data, error: pinError } = await supabase
      .from('forum_tickets')
      .update({ epingle })
      .eq('id', ticket.id)
      .select('id')
    setPinning(false)
    if (pinError) {
      setActionError(friendlyPinError(pinError))
    } else if (!data || data.length === 0) {
      setActionError("Tu n'as pas le droit d'épingler cette question.")
    } else {
      onUpdated({ epingle })
    }
  }

  async function handleDeleteTicket() {
    if (!confirm('Supprimer ce ticket et tous ses messages ? Cette action est irréversible.')) return
    setDeletingTicket(true)
    const { error: deleteError } = await supabase.from('forum_tickets').delete().eq('id', ticket.id)
    if (deleteError) {
      setDeletingTicket(false)
      alert('Erreur : ' + deleteError.message)
      return
    }
    onDeleted()
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm('Supprimer ce message ?')) return
    const previous = messages
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    const { error: deleteError } = await supabase.from('forum_messages').delete().eq('id', messageId)
    if (deleteError) {
      setMessages(previous)
      alert('Erreur : ' + deleteError.message)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function charger() {
      setLoading(true)
      setActionError(null)
      setError(null)
      const { data } = await supabase
        .from('forum_messages')
        .select(MESSAGE_COLUMNS)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })

      if (cancelled) return
      const rows = (data ?? []) as ForumMessage[]
      setMessages(rows)
      setPseudos(await fetchPseudoMap(supabase, rows.map((m) => m.user_id)))
      setLoading(false)
    }

    charger()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id])

  async function handleSend(texte: string, imageFile: File | null): Promise<boolean> {
    if (sending) return false
    setSending(true)
    setError(null)

    let imageUrl: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${ticket.id}/${userId}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('forum-images').upload(path, imageFile)

      if (uploadError) {
        setError(uploadError.message)
        setSending(false)
        return false
      }

      const { data: urlData } = supabase.storage.from('forum-images').getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('forum_messages')
      .insert({ ticket_id: ticket.id, user_id: userId, contenu: texte, image_url: imageUrl })
      .select(MESSAGE_COLUMNS)
      .single()

    if (insertError || !newMessage) {
      setError(insertError?.message ?? "Erreur lors de l'envoi du message.")
      setSending(false)
      return false
    }

    setMessages((prev) => [...prev, newMessage as ForumMessage])
    setSending(false)
    // Première réponse de l'utilisateur dans cette discussion : son pseudo
    // n'a pas encore été chargé — on le récupère au lieu d'afficher "—".
    if (!pseudos.has(userId)) {
      fetchPseudoMap(supabase, [userId]).then((map) => {
        setPseudos((prev) => new Map(prev).set(userId, map.get(userId) ?? '—'))
      })
    }
    return true
  }

  const menuItems: KebabItem[] = []
  if (isAdmin && isQuestion) {
    menuItems.push({
      label: pinning ? '…' : ticket.epingle ? 'Désépingler' : 'Épingler',
      onClick: handleTogglePin,
      disabled: pinning,
    })
  }
  if (canManageTicket && !isFerme) {
    menuItems.push({
      label: resolving ? 'Fermeture…' : 'Marquer comme résolu',
      onClick: handleResolve,
      disabled: resolving,
    })
  }
  if (canManageTicket) {
    menuItems.push({
      label: deletingTicket ? 'Suppression…' : 'Supprimer',
      onClick: handleDeleteTicket,
      disabled: deletingTicket,
      danger: true,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex shrink-0 items-start gap-2 border-b border-border bg-surface px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-surface-2 md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate font-semibold text-text-primary">{ticket.titre}</h2>
          {(ticket.epingle || ticket.sujet || reference || ticket.statut) && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
              {ticket.epingle && <span title="Épinglée" aria-label="Épinglée">📌</span>}
              {ticket.sujet && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-medium text-text-secondary">
                  {SUJET_LABEL[ticket.sujet]}
                </span>
              )}
              {reference && <span className="truncate text-text-muted">{reference}</span>}
              {ticket.statut && (
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium ${STATUT_STYLE[ticket.statut] ?? 'bg-surface-2 text-text-secondary'}`}>
                  {STATUT_LABEL[ticket.statut] ?? ticket.statut}
                </span>
              )}
            </div>
          )}
          {actionError && <p className="text-xs text-danger">{actionError}</p>}
        </div>

        <KebabMenu label="Actions de la question" items={menuItems} />
      </header>

      <MessageList
        messages={messages}
        pseudos={pseudos}
        userId={userId}
        isAdmin={isAdmin}
        loading={loading}
        onDeleteMessage={handleDeleteMessage}
      />

      {isFerme ? (
        <div className="shrink-0 border-t border-border bg-surface px-4 py-3 text-center text-sm font-medium text-success">
          Question résolue
        </div>
      ) : (
        <Composer key={ticket.id} sending={sending} error={error} onSend={handleSend} />
      )}
    </div>
  )
}
