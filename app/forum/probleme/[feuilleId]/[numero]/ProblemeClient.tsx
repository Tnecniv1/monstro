'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSignedPdfUrl } from '@/lib/getSignedPdfUrl'
import MathText from '../../../../components/MathText'
import { FilQuestion, MESSAGE_COLUMNS, useFilQuestions } from '../../../FilQuestions'
import { friendlyTicketError } from '../../../NouveauTicketModal'
import { TICKET_COLUMNS, titreQuestionProbleme } from '../../../types'
import type { ForumMessage, ForumTicket } from '../../../types'

interface Props {
  feuille: { id: string; titre: string; pdf_url: string | null }
  numero: number
  userId: string
  isAdmin: boolean
}

export default function ProblemeClient({ feuille, numero, userId, isAdmin }: Props) {
  const fil = useFilQuestions({
    userId,
    isAdmin,
    cle: `${feuille.id}:${numero}`,
    chargerTickets: (supabase) =>
      supabase
        .from('forum_tickets')
        .select(TICKET_COLUMNS)
        .is('topic_id', null)
        .eq('sujet', 'probleme')
        .eq('feuille_id', feuille.id)
        .eq('numero_exercice', numero)
        .order('created_at', { ascending: false }),
  })
  const { supabase } = fil

  // Question : sujet Problème et référence feuille + numéro automatiques,
  // titre « <feuille> · n° <numero> ». Renvoie un message d'erreur ou null.
  async function poserQuestion(texte: string, imageFile: File | null): Promise<string | null> {
    const { data: ticket, error: ticketError } = await supabase
      .from('forum_tickets')
      .insert({
        topic_id: null,
        sujet: 'probleme',
        feuille_id: feuille.id,
        numero_exercice: numero,
        script_id: null,
        user_id: userId,
        titre: titreQuestionProbleme(feuille.titre, numero),
      })
      .select(TICKET_COLUMNS)
      .single()
    if (ticketError || !ticket) return friendlyTicketError(ticketError?.message)

    let imageUrl: string | null = null
    try {
      if (imageFile) imageUrl = await fil.televerserImage(ticket.id, imageFile)
    } catch (e) {
      return (e as Error).message
    }

    const { data: message, error: messageError } = await supabase
      .from('forum_messages')
      .insert({ ticket_id: ticket.id, user_id: userId, contenu: texte, image_url: imageUrl })
      .select(MESSAGE_COLUMNS)
      .single()
    if (messageError || !message) return messageError?.message ?? "Erreur lors de l'envoi de la question."

    fil.ajouterQuestion(ticket as ForumTicket, message as ForumMessage)
    return null
  }

  const nb = fil.tickets.length

  return (
    <div className="space-y-5">
      <CarteEnonce feuille={feuille} numero={numero} />

      <BlocQuestion
        bloque={fil.aUneQuestionOuverte === true}
        pret={fil.aUneQuestionOuverte !== null}
        onEnvoyer={poserQuestion}
      />

      <section className="space-y-5">
        <h2 className="text-lg font-bold text-text-primary">
          {nb} question{nb > 1 ? 's' : ''}
        </h2>
        {fil.loading ? (
          <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>
        ) : nb === 0 ? (
          <p className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
            Aucune question sur ce problème pour l&apos;instant.
          </p>
        ) : (
          fil.tickets.map((t) => <FilQuestion key={t.id} ticket={t} fil={fil} userId={userId} isAdmin={isAdmin} />)
        )}
      </section>
    </div>
  )
}

// Carte énoncé : l'énoncé seul n'existe pas en base, d'où le lien vers le PDF
// de la feuille (même ouverture que la Bibliothèque : URL signée + /viewer).
function CarteEnonce({ feuille, numero }: { feuille: Props['feuille']; numero: number }) {
  const router = useRouter()
  const [ouverture, setOuverture] = useState(false)

  async function ouvrirPdf() {
    if (!feuille.pdf_url) return
    setOuverture(true)
    const signed = await getSignedPdfUrl(feuille.pdf_url)
    setOuverture(false)
    if (signed) router.push(`/viewer?url=${encodeURIComponent(signed)}`)
  }

  return (
    <section className="space-y-1 rounded-[22px] border border-border bg-surface p-7">
      <p className="text-xs font-bold uppercase tracking-[0.04em] text-text-muted">{feuille.titre}</p>
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-primary">Problème {numero}</h1>
      {feuille.pdf_url && (
        <button
          type="button"
          onClick={ouvrirPdf}
          disabled={ouverture}
          className="-ml-2 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-accent hover:underline disabled:opacity-50"
        >
          {ouverture ? 'Ouverture…' : 'Voir la feuille (PDF)'}
        </button>
      )}
    </section>
  )
}

// Bloc « Bloqué ? » : désactivé tant que l'élève a déjà une question ouverte.
function BlocQuestion({
  bloque,
  pret,
  onEnvoyer,
}: {
  bloque: boolean
  pret: boolean
  onEnvoyer: (texte: string, image: File | null) => Promise<string | null>
}) {
  const [texte, setTexte] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [apercu, setApercu] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  const desactive = bloque || !pret || envoi

  function choisirImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setImage(f)
    setApercu(f ? URL.createObjectURL(f) : null)
  }

  function retirerImage() {
    setImage(null)
    setApercu(null)
    if (fichierRef.current) fichierRef.current.value = ''
  }

  async function envoyer() {
    const t = texte.trim()
    if (!t || desactive) return
    setEnvoi(true)
    setErreur(null)
    const err = await onEnvoyer(t, image)
    setEnvoi(false)
    if (err) {
      setErreur(err)
      return
    }
    setTexte('')
    retirerImage()
  }

  return (
    <section className="space-y-3 rounded-[14px] border border-border bg-surface p-5">
      <h2 className="text-base font-bold text-text-primary">Bloqué ? Pose ta question sur ce problème</h2>

      {bloque && (
        <p className="rounded-xl bg-accent/5 px-4 py-3 text-sm text-text-primary">
          Tu as déjà une question ouverte. Clique sur «&nbsp;Résolu&nbsp;» quand c&apos;est clair pour toi, et tu
          pourras en poser une nouvelle.
        </p>
      )}

      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        disabled={desactive}
        rows={4}
        placeholder="Explique où tu bloques ($...$ pour les maths)"
        className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-surface-2 disabled:opacity-60"
      />

      {texte.includes('$') && (
        <div className="max-h-32 overflow-y-auto rounded-xl bg-surface-2 px-3 py-2 text-sm text-text-primary whitespace-pre-wrap break-words">
          <MathText text={texte} />
        </div>
      )}

      {apercu && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apercu} alt="" className="max-h-32 rounded-lg border border-border" />
          <button
            type="button"
            onClick={retirerImage}
            aria-label="Retirer la photo"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs text-text-muted hover:text-text-secondary"
          >
            ×
          </button>
        </div>
      )}

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className={`inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-4 text-sm font-semibold text-text-primary transition-colors ${
            desactive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-surface-2'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Ajouter une photo
          <input ref={fichierRef} type="file" accept="image/*" onChange={choisirImage} disabled={desactive} className="hidden" />
        </label>

        <button
          type="button"
          onClick={envoyer}
          disabled={desactive || !texte.trim()}
          className="h-11 rounded-[10px] bg-accent px-6 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:bg-border-strong disabled:hover:opacity-100"
        >
          {envoi ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </section>
  )
}
