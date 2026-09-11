'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActiveTopic, ForumTicket } from './types'

interface Props {
  activeTopic: ActiveTopic
  userId: string
  onClose: () => void
  onCreated: (ticket: ForumTicket) => void
}

export default function NouveauTicketModal({ activeTopic, userId, onClose, onCreated }: Props) {
  const supabase = createClient()

  const [titre, setTitre] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !message.trim()) return

    setLoading(true)
    setError(null)

    // Une seule des deux colonnes est renseignée (contrainte CHECK d'exclusivité).
    // Pas de `statut` à l'insertion : la colonne prend sa valeur par défaut côté DB.
    const { data: ticket, error: ticketError } = await supabase
      .from('forum_tickets')
      .insert({
        topic_id: activeTopic.kind === 'sens' ? activeTopic.id : null,
        feuille_id: activeTopic.kind === 'feuille' ? activeTopic.id : null,
        user_id: userId,
        titre: titre.trim(),
      })
      .select('id, topic_id, feuille_id, user_id, titre, statut, created_at')
      .single()

    if (ticketError || !ticket) {
      setError(ticketError?.message ?? 'Erreur lors de la création du ticket.')
      setLoading(false)
      return
    }

    const { error: messageError } = await supabase
      .from('forum_messages')
      .insert({ ticket_id: ticket.id, user_id: userId, contenu: message.trim() })

    if (messageError) {
      setError(messageError.message)
      setLoading(false)
      return
    }

    onCreated(ticket as ForumTicket)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-text-primary">Nouveau ticket</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary transition-colors text-2xl leading-none p-2 -mr-2"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Titre</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              autoFocus
              required
              placeholder="Résume ta question en quelques mots"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              placeholder="Décris ta question ($...$ pour les maths)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-text-secondary hover:bg-surface-2 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || !titre.trim() || !message.trim()}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
