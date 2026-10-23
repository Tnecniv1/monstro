'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useForumAttente } from '../components/ForumAttenteProvider'
import MathText from '../components/MathText'
import Composer from './Composer'
import KebabMenu from './KebabMenu'
import { STATUT_STYLE } from './questionMeta'
import { formatRelative } from './relativeTime'
import type { ForumMessage, ForumTicket } from './types'

// Fil de questions-réponses, partagé par la page d'un problème et la page
// d'une question : chargement, lecture, réponses, résolution, suppression.

export const MESSAGE_COLUMNS = 'id, ticket_id, user_id, contenu, image_url, created_at'

type SupabaseClient = ReturnType<typeof createClient>

type Auteur = {
  id: string
  pseudo: string | null
  prenom: string | null
  nom: string | null
  role: string | null
}

export function useFilQuestions({
  userId,
  isAdmin,
  cle,
  chargerTickets,
}: {
  userId: string
  isAdmin: boolean
  // Change quand les questions à afficher changent (rechargement).
  cle: string
  chargerTickets: (supabase: SupabaseClient) => PromiseLike<{ data: unknown[] | null }>
}) {
  const supabase = createClient()
  const { refresh: refreshAttente } = useForumAttente()

  const [tickets, setTickets] = useState<ForumTicket[]>([])
  const [messages, setMessages] = useState<ForumMessage[]>([])
  const [auteurs, setAuteurs] = useState<Map<string, Auteur>>(new Map())
  const [loading, setLoading] = useState(true)
  // Question ouverte de l'utilisateur, tous sujets confondus (trigger
  // forum_enforce_one_open_ticket). null tant que non vérifié.
  const [aUneQuestionOuverte, setAUneQuestionOuverte] = useState<boolean | null>(null)

  async function chargerAuteurs(ids: string[]) {
    const manquants = Array.from(new Set(ids)).filter((id) => !auteurs.has(id))
    if (manquants.length === 0) return
    const { data } = await supabase.from('user_profile').select('id, pseudo, prenom, nom, role').in('id', manquants)
    setAuteurs((prev) => {
      const next = new Map(prev)
      ;((data ?? []) as Auteur[]).forEach((a) => next.set(a.id, a))
      return next
    })
  }

  async function verifierQuestionOuverte() {
    if (isAdmin) {
      setAUneQuestionOuverte(false)
      return
    }
    const { data } = await supabase
      .from('forum_tickets')
      .select('id')
      .eq('user_id', userId)
      .neq('statut', 'ferme')
      .limit(1)
    setAUneQuestionOuverte((data ?? []).length > 0)
  }

  // Lecture enregistrée (forum_lecture, lu_le imposé par trigger) puis
  // pastilles recalculées. Échec silencieux, comme dans Conversation.
  async function marquerLus(ticketIds: string[]) {
    if (ticketIds.length === 0) return
    await supabase.from('forum_lecture').upsert(
      ticketIds.map((id) => ({ user_id: userId, ticket_id: id, lu_le: new Date().toISOString() })),
      { onConflict: 'user_id,ticket_id' }
    )
    refreshAttente()
  }

  useEffect(() => {
    let cancelled = false
    async function charger() {
      const { data } = await chargerTickets(supabase)
      const rows = (data ?? []) as ForumTicket[]
      const ids = rows.map((t) => t.id)
      const { data: msgs } = ids.length
        ? await supabase.from('forum_messages').select(MESSAGE_COLUMNS).in('ticket_id', ids).order('created_at', { ascending: true })
        : { data: [] }
      if (cancelled) return
      const messagesCharges = (msgs ?? []) as ForumMessage[]
      setTickets(rows)
      setMessages(messagesCharges)
      await chargerAuteurs([...rows.map((t) => t.user_id), ...messagesCharges.map((m) => m.user_id)])
      if (cancelled) return
      setLoading(false)
      // Ouvrir la page marque ses questions comme lues.
      marquerLus(ids)
    }
    charger()
    verifierQuestionOuverte()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  async function televerserImage(ticketId: string, imageFile: File): Promise<string> {
    const ext = imageFile.name.split('.').pop()
    const path = `${ticketId}/${userId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('forum-images').upload(path, imageFile)
    if (error) throw new Error(error.message)
    return supabase.storage.from('forum-images').getPublicUrl(path).data.publicUrl
  }

  // Question créée ailleurs (bloc « Bloqué ? ») : ajoutée en tête du fil.
  function ajouterQuestion(ticket: ForumTicket, message: ForumMessage) {
    setTickets((prev) => [ticket, ...prev])
    setMessages((prev) => [...prev, message])
    chargerAuteurs([userId])
    if (!isAdmin) setAUneQuestionOuverte(true)
    marquerLus([ticket.id])
  }

  async function repondre(ticketId: string, texte: string, imageFile: File | null): Promise<string | null> {
    let imageUrl: string | null = null
    try {
      if (imageFile) imageUrl = await televerserImage(ticketId, imageFile)
    } catch (e) {
      return (e as Error).message
    }
    const { data: message, error } = await supabase
      .from('forum_messages')
      .insert({ ticket_id: ticketId, user_id: userId, contenu: texte, image_url: imageUrl })
      .select(MESSAGE_COLUMNS)
      .single()
    if (error || !message) return error?.message ?? "Erreur lors de l'envoi du message."
    setMessages((prev) => [...prev, message as ForumMessage])
    chargerAuteurs([userId])
    marquerLus([ticketId])
    return null
  }

  // .select('id') : une mise à jour filtrée par la RLS renvoie 0 ligne sans erreur.
  async function resoudre(ticketId: string): Promise<string | null> {
    const { data, error } = await supabase.from('forum_tickets').update({ statut: 'ferme' }).eq('id', ticketId).select('id')
    if (error) return error.message
    if (!data || data.length === 0) return "Tu n'as pas le droit de fermer cette question."
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, statut: 'ferme' } : t)))
    refreshAttente()
    verifierQuestionOuverte()
    return null
  }

  // Renvoie true si la question a été supprimée.
  async function supprimerQuestion(ticketId: string): Promise<boolean> {
    if (!confirm('Supprimer cette question et toutes ses réponses ? Cette action est irréversible.')) return false
    const { error } = await supabase.from('forum_tickets').delete().eq('id', ticketId)
    if (error) {
      alert('Erreur : ' + error.message)
      return false
    }
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setMessages((prev) => prev.filter((m) => m.ticket_id !== ticketId))
    refreshAttente()
    verifierQuestionOuverte()
    return true
  }

  // Épinglage (FAQ, admin) : le trigger sur forum_tickets refuse ce changement
  // à un non-admin (code P0001). .select('id') : 0 ligne = refus de la RLS.
  async function basculerEpingle(ticket: ForumTicket) {
    const epingle = !ticket.epingle
    const { data, error } = await supabase.from('forum_tickets').update({ epingle }).eq('id', ticket.id).select('id')
    if (error || !data || data.length === 0) {
      alert(
        error?.code === 'P0001' || !error
          ? 'Seul un admin peut épingler ou désépingler une question.'
          : 'Erreur : ' + error.message
      )
      return
    }
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, epingle } : t)))
  }

  async function supprimerMessage(messageId: string) {
    if (!confirm('Supprimer ce message ?')) return
    const precedent = messages
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    const { error } = await supabase.from('forum_messages').delete().eq('id', messageId)
    if (error) {
      setMessages(precedent)
      alert('Erreur : ' + error.message)
    }
  }

  return {
    supabase,
    tickets,
    messages,
    auteurs,
    loading,
    aUneQuestionOuverte,
    televerserImage,
    ajouterQuestion,
    repondre,
    resoudre,
    supprimerQuestion,
    supprimerMessage,
    basculerEpingle,
  }
}

export type FilQuestions = ReturnType<typeof useFilQuestions>

function nomAffiche(auteur: Auteur | undefined, estMoi: boolean): string {
  if (estMoi) return 'Toi'
  if (!auteur) return '—'
  const complet = [auteur.prenom, auteur.nom].filter(Boolean).join(' ').trim()
  return auteur.pseudo || complet || '—'
}

function initiales(auteur: Auteur | undefined): string {
  if (!auteur) return '?'
  if (auteur.prenom || auteur.nom) {
    return `${auteur.prenom?.[0] ?? ''}${auteur.nom?.[0] ?? ''}`.toUpperCase() || '?'
  }
  return (auteur.pseudo ?? '?').slice(0, 2).toUpperCase()
}

// Avatar à initiales : 36 px (question) ou 32 px (réponse) ; fond accent
// plein et lettres blanches pour l'admin.
function Pastille({ auteur, taille }: { auteur: Auteur | undefined; taille: 'grand' | 'petit' }) {
  const admin = auteur?.role === 'admin'
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
        admin ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
      } ${taille === 'grand' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-[11px]'}`}
    >
      {initiales(auteur)}
    </span>
  )
}

function Contenu({ message }: { message: ForumMessage }) {
  return (
    <>
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
        <MathText text={message.contenu} />
      </div>
      {message.image_url && (
        <a href={message.image_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={message.image_url} alt="" className="max-h-72 rounded-lg border border-border object-contain" />
        </a>
      )}
    </>
  )
}

// Une question et ses réponses. Le premier message est le texte de la
// question ; les suivants sont les réponses, décalées de 48 px.
export function FilQuestion({
  ticket,
  fil,
  userId,
  isAdmin,
  onSupprimee,
}: {
  ticket: ForumTicket
  fil: FilQuestions
  userId: string
  isAdmin: boolean
  // Après suppression de la question (page d'une question : retour au forum).
  onSupprimee?: () => void
}) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resolution, setResolution] = useState(false)

  const [question, ...reponses] = fil.messages.filter((m) => m.ticket_id === ticket.id)
  const auteur = fil.auteurs.get(ticket.user_id)
  const estAuteur = ticket.user_id === userId
  const ouverte = ticket.statut !== 'ferme'

  async function envoyer(texte: string, image: File | null): Promise<boolean> {
    setEnvoi(true)
    setErreur(null)
    const err = await fil.repondre(ticket.id, texte, image)
    setEnvoi(false)
    setErreur(err)
    return err === null
  }

  async function resoudre() {
    setResolution(true)
    setErreur(null)
    const err = await fil.resoudre(ticket.id)
    setResolution(false)
    if (err) setErreur(err)
  }

  async function supprimer() {
    if (await fil.supprimerQuestion(ticket.id)) onSupprimee?.()
  }

  return (
    <article className="space-y-4 rounded-[14px] border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Pastille auteur={auteur} taille="grand" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text-primary">{nomAffiche(auteur, estAuteur)}</p>
          <p className="text-xs text-text-muted">{formatRelative(ticket.created_at)}</p>
        </div>
        {ticket.statut && (
          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${STATUT_STYLE[ticket.statut]}`}>
            {ouverte ? 'Ouverte' : 'Résolue'}
          </span>
        )}
        {(estAuteur || isAdmin) && (
          <KebabMenu
            label="Actions de la question"
            items={[
              // Questions de la FAQ (Méthode, Application) : épinglage par l'admin.
              ...(isAdmin && (ticket.sujet === 'methode' || ticket.sujet === 'application')
                ? [{ label: ticket.epingle ? 'Désépingler' : 'Épingler', onClick: () => fil.basculerEpingle(ticket) }]
                : []),
              { label: 'Supprimer la question', danger: true, onClick: supprimer },
            ]}
          />
        )}
      </div>

      {question && <Contenu message={question} />}

      {reponses.length > 0 && (
        <div className="space-y-3">
          {reponses.map((m) => {
            const a = fil.auteurs.get(m.user_id)
            const estMoi = m.user_id === userId
            return (
              <div key={m.id} className="ml-12 space-y-2 rounded-xl bg-bg p-4">
                <div className="flex items-center gap-2">
                  <Pastille auteur={a} taille="petit" />
                  <span className="truncate text-sm font-bold text-text-primary">{nomAffiche(a, estMoi)}</span>
                  {a?.role === 'admin' && (
                    <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold text-accent">PROF</span>
                  )}
                  <span className="shrink-0 text-xs text-text-muted">{formatRelative(m.created_at)}</span>
                  {(estMoi || isAdmin) && (
                    <span className="ml-auto">
                      <KebabMenu
                        label="Actions du message"
                        buttonClassName="h-7 w-7"
                        items={[{ label: 'Supprimer le message', danger: true, onClick: () => fil.supprimerMessage(m.id) }]}
                      />
                    </span>
                  )}
                </div>
                <Contenu message={m} />
              </div>
            )
          })}
        </div>
      )}

      {ouverte ? (
        <div className="flex flex-wrap items-end gap-2">
          <Composer sending={envoi} error={erreur} onSend={envoyer} placeholder="Répondre…" variante="fil" />
          {(estAuteur || isAdmin) && (
            <button
              type="button"
              onClick={resoudre}
              disabled={resolution}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] border border-success bg-success/10 px-4 text-sm font-bold text-success transition-colors hover:bg-success/15 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {resolution ? 'Fermeture…' : 'Résolu'}
            </button>
          )}
        </div>
      ) : (
        <p className="border-t border-border pt-4 text-center text-sm font-medium text-success">Question résolue</p>
      )}
    </article>
  )
}
