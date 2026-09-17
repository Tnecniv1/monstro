'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MathText from '../components/MathText'
import { fetchPseudoMap } from './profiles'
import { formatRelative } from './relativeTime'
import type { ForumMessage, ForumTicket } from './types'

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

interface Props {
  ticket: ForumTicket
  authorPseudo: string
  userId: string
  isAdmin: boolean
  onBack: () => void
  onResolved: () => void
  onDeleted: () => void
}

export default function TicketDetail({ ticket, authorPseudo, userId, isAdmin, onBack, onResolved, onDeleted }: Props) {
  const supabase = createClient()

  const [messages, setMessages] = useState<ForumMessage[]>([])
  const [pseudos, setPseudos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [deletingTicket, setDeletingTicket] = useState(false)

  const isAuthor = ticket.user_id === userId
  const isFerme = ticket.statut === 'ferme'
  const canManageTicket = isAuthor || isAdmin

  async function handleResolve() {
    setResolving(true)
    const { error: resolveError } = await supabase
      .from('forum_tickets')
      .update({ statut: 'ferme' })
      .eq('id', ticket.id)
    setResolving(false)
    if (!resolveError) onResolved()
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

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function charger() {
      setLoading(true)
      const { data } = await supabase
        .from('forum_messages')
        .select('id, ticket_id, user_id, contenu, image_url, created_at')
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const texte = input.trim()
    if (!texte || sending) return

    setSending(true)
    setError(null)

    let imageUrl: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${ticket.id}/${userId}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('forum-images')
        .upload(path, imageFile)

      if (uploadError) {
        setError(uploadError.message)
        setSending(false)
        return
      }

      const { data: urlData } = supabase.storage.from('forum-images').getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('forum_messages')
      .insert({ ticket_id: ticket.id, user_id: userId, contenu: texte, image_url: imageUrl })
      .select('id, ticket_id, user_id, contenu, image_url, created_at')
      .single()

    if (insertError || !newMessage) {
      setError(insertError?.message ?? "Erreur lors de l'envoi du message.")
      setSending(false)
      return
    }

    setMessages((prev) => [...prev, newMessage as ForumMessage])
    setPseudos((prev) => new Map(prev).set(userId, prev.get(userId) ?? '—'))
    setInput('')
    clearImage()
    setSending(false)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-text-muted hover:text-text-secondary transition-colors">
        ← Tickets
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="font-semibold text-text-primary text-lg truncate">{ticket.titre}</h2>
          <p className="text-xs text-text-muted">
            {authorPseudo} · {formatRelative(ticket.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAuthor && !isFerme && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              {resolving ? 'Fermeture…' : 'Marquer comme résolu'}
            </button>
          )}
          {canManageTicket && (
            <button
              onClick={handleDeleteTicket}
              disabled={deletingTicket}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors"
            >
              {deletingTicket ? 'Suppression…' : 'Supprimer'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 space-y-4 max-h-[480px] overflow-y-auto">
        {loading && <p className="text-sm text-text-muted text-center py-8">Chargement…</p>}

        {!loading && messages.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">Aucun message.</p>
        )}

        {!loading &&
          messages.map((m) => {
            const canDeleteMessage = m.user_id === userId || isAdmin
            return (
              <div key={m.id} className="group space-y-1">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">{pseudos.get(m.user_id) ?? '—'}</span>
                  <span>·</span>
                  <span>{formatRelative(m.created_at)}</span>
                  {canDeleteMessage && (
                    <button
                      onClick={() => handleDeleteMessage(m.id)}
                      aria-label="Supprimer ce message"
                      title="Supprimer"
                      className="ml-auto opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-opacity"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                  <MathText text={m.contenu} />
                  {m.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.image_url}
                      alt=""
                      className="mt-2 rounded-lg max-h-64 object-contain border border-border"
                    />
                  )}
                </div>
              </div>
            )
          })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 border-t border-border pt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          rows={3}
          placeholder="Écris ta réponse… ($...$ pour les maths)"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 resize-none"
        />

        {input.trim() && (
          <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary whitespace-pre-wrap">
            <p className="text-xs font-medium text-text-muted mb-1">Aperçu</p>
            <MathText text={input} />
          </div>
        )}

        {imagePreviewUrl && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl} alt="" className="max-h-32 rounded-lg border border-border" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Retirer l'image"
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-border text-text-muted flex items-center justify-center text-xs hover:text-text-secondary transition-colors"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
            📎 Image
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={sending}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-3">
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sending ? 'Envoi…' : 'Répondre'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
