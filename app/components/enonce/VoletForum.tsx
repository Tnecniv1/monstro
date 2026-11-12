'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { ExerciceEnCours } from '@/lib/exerciceEnCours'
import MathText from '../MathText'
import Composer from '../../forum/Composer'
import { poserQuestionProbleme, useFilQuestions, type FilQuestions } from '../../forum/FilQuestions'
import { formatHeure, jourParis, libelleJour } from '../../forum/relativeTime'
import { TICKET_COLUMNS } from '../../forum/types'
import type { ForumTicket } from '../../forum/types'

// Volet Forum de l'énoncé flottant : la question de l'élève sur l'exercice en
// cours (questions Problème du forum, feuille + numéro), celles des autres,
// et la barre d'envoi. Mêmes données et règles que la page du problème
// (useFilQuestions) : ouvrir le volet marque ses questions comme lues.
// Monté seulement quand le volet est affiché. Pas de temps réel : rechargé à
// la réouverture du panneau ou par « Actualiser ».
export default function VoletForum({ exercice, userId }: { exercice: ExerciceEnCours; userId: string }) {
  const [version, setVersion] = useState(0)
  const fil = useFilQuestions({
    userId,
    isAdmin: false,
    cle: `${exercice.feuilleId}:${exercice.exo}:${version}`,
    chargerTickets: (supabase) =>
      supabase
        .from('forum_tickets')
        .select(TICKET_COLUMNS)
        .is('topic_id', null)
        .eq('sujet', 'probleme')
        .eq('feuille_id', exercice.feuilleId)
        .eq('numero_exercice', exercice.exo)
        .order('created_at', { ascending: false }),
  })

  // Question affichée en lecture (une question d'un autre élève, ou une
  // ancienne de l'élève) ; null : vue principale.
  const [lectureId, setLectureId] = useState<string | null>(null)
  const [listeOuverte, setListeOuverte] = useState(false)

  // Sa question sur cet exercice : l'ouverte, sinon la plus récente.
  const miennes = fil.tickets.filter((t) => t.user_id === userId)
  const maQuestion = miennes.find((t) => t.statut !== 'ferme') ?? miennes[0] ?? null
  const autres = fil.tickets.filter((t) => t.id !== maQuestion?.id)
  const enLecture = lectureId ? fil.tickets.find((t) => t.id === lectureId) ?? null : null

  // Question ouverte ailleurs (autre exercice ou autre sujet) : bloque la
  // création d'une nouvelle question (trigger forum_enforce_one_open_ticket).
  const ouverteAilleurs =
    fil.questionOuverte && !fil.tickets.some((t) => t.id === fil.questionOuverte!.id) ? fil.questionOuverte : null
  const titreFeuilleAilleurs = useTitreFeuille(fil, ouverteAilleurs?.feuille_id ?? null)

  function actualiser() {
    setVersion((v) => v + 1)
  }

  if (fil.loading) {
    return <p className="flex-1 py-10 text-center text-sm text-text-muted">Chargement…</p>
  }

  if (enLecture) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
          <button
            type="button"
            onClick={() => setLectureId(null)}
            className="-ml-2 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-text-secondary hover:text-text-primary"
          >
            ‹ Retour
          </button>
          <span className="flex-1" />
          <Statut ticket={enLecture} />
          <BoutonActualiser onClick={actualiser} />
        </div>
        <Fil ticket={enLecture} fil={fil} userId={userId} />
        <BasDeConversation ticket={enLecture} fil={fil} userId={userId} />
      </div>
    )
  }

  const lienAutres =
    autres.length > 0 ? (
      <ListeAutres
        autres={autres}
        fil={fil}
        ouverte={listeOuverte}
        onBasculer={() => setListeOuverte((o) => !o)}
        onOuvrir={setLectureId}
      />
    ) : null

  // Nouvelle question : bloquée par une question ouverte sur un autre exercice.
  const barreNouvelle = ouverteAilleurs ? (
    <Blocage question={ouverteAilleurs} titreFeuille={titreFeuilleAilleurs} />
  ) : (
    <BarreEnvoi
      placeholder={maQuestion ? 'Poser une nouvelle question…' : 'Écrire ta question…'}
      onEnvoyer={(texte, image) =>
        poserQuestionProbleme(
          fil,
          { feuilleId: exercice.feuilleId, feuilleTitre: exercice.titre, numero: exercice.exo, userId },
          texte,
          image
        )
      }
    />
  )

  if (!maQuestion) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#EDE9FE' }}>
              <IconeBulle />
            </span>
            <p className="mt-4 text-lg font-extrabold text-text-primary">Bloqué sur l’exercice {exercice.exo} ?</p>
            <p className="mt-2 max-w-[320px] text-sm text-text-secondary">
              Pose ta question ici : elle sera liée à cet exercice, et un étudiant te répondra. Tu peux joindre une photo
              de ton brouillon.
            </p>
            <div className="mt-5 w-full">
              {lienAutres ?? (
                <p className="text-sm text-text-muted">Personne n’a encore posé de question sur cet exercice.</p>
              )}
            </div>
            <div className="mt-3">
              <BoutonActualiser onClick={actualiser} />
            </div>
          </div>
        </div>
        {barreNouvelle}
      </div>
    )
  }

  const ouverte = maQuestion.statut !== 'ferme'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-text-muted">Ta question</p>
        <Statut ticket={maQuestion} />
        <span className="flex-1" />
        <BoutonActualiser onClick={actualiser} />
      </div>
      {lienAutres && <div className="shrink-0 px-4 pb-2">{lienAutres}</div>}
      <Fil ticket={maQuestion} fil={fil} userId={userId} />
      {ouverte ? <BasDeConversation ticket={maQuestion} fil={fil} userId={userId} /> : barreNouvelle}
    </div>
  )
}

// Titre d'une feuille (message de blocage) ; null tant que non chargé.
function useTitreFeuille(fil: FilQuestions, feuilleId: string | null): string | null {
  const [titre, setTitre] = useState<string | null>(null)
  useEffect(() => {
    setTitre(null)
    if (!feuilleId) return
    let annule = false
    fil.supabase
      .from('feuille_entrainement')
      .select('titre')
      .eq('id', feuilleId)
      .maybeSingle()
      .then(({ data }) => {
        if (!annule) setTitre((data as { titre: string } | null)?.titre ?? null)
      })
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feuilleId])
  return titre
}

function Statut({ ticket }: { ticket: ForumTicket }) {
  const ouverte = ticket.statut !== 'ferme'
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={ouverte ? { background: '#FEF3C7', color: '#B45309' } : { background: '#DCFCE7', color: '#15803D' }}
    >
      {ouverte ? 'Ouverte' : 'Résolue'}
    </span>
  )
}

function BoutonActualiser({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text-secondary"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
        <polyline points="21 3 21 8 16 8" />
      </svg>
      Actualiser
    </button>
  )
}

// « N autres questions sur cet exercice · Voir », liste repliable.
function ListeAutres({
  autres,
  fil,
  ouverte,
  onBasculer,
  onOuvrir,
}: {
  autres: ForumTicket[]
  fil: FilQuestions
  ouverte: boolean
  onBasculer: () => void
  onOuvrir: (id: string) => void
}) {
  const n = autres.length
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouverte}
        className="inline-flex min-h-[36px] items-center text-sm text-text-secondary"
      >
        {n === 1 ? '1 autre question' : `${n} autres questions`} sur cet exercice ·&nbsp;
        <span className="font-semibold text-accent">{ouverte ? 'Masquer' : 'Voir'}</span>
      </button>
      {ouverte && (
        <ul className="mt-1 space-y-1.5">
          {autres.map((t) => {
            const premier = fil.messages.find((m) => m.ticket_id === t.id)
            const auteur = fil.auteurs.get(t.user_id)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOuvrir(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <Initiale pseudo={auteur?.pseudo ?? null} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">
                      {premier?.contenu.replace(/\s+/g, ' ') ?? '…'}
                    </span>
                    <span className="block truncate text-xs text-text-muted">{auteur?.pseudo?.trim() || '—'}</span>
                  </span>
                  <Statut ticket={t} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Conversation d'une question en bulles : l'élève à droite (violet), les
// autres à gauche (gris, rond initiale), « auteur · heure » sous la bulle.
function Fil({ ticket, fil, userId }: { ticket: ForumTicket; fil: FilQuestions; userId: string }) {
  const messages = fil.messages.filter((m) => m.ticket_id === ticket.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [imageAgrandie, setImageAgrandie] = useState<string | null>(null)

  // Ouverture et nouveau message : défilement vers le dernier.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [ticket.id, messages.length])

  const aujourdhui = jourParis(new Date().toISOString())

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {messages.map((m) => {
        const estMoi = m.user_id === userId
        const auteur = fil.auteurs.get(m.user_id)
        const jour = jourParis(m.created_at)
        const quand = jour === aujourdhui ? formatHeure(m.created_at) : `${libelleJour(jour)}, ${formatHeure(m.created_at)}`
        const nom = estMoi ? 'Toi' : auteur?.pseudo?.trim() || '—'
        return (
          <div key={m.id} className={`flex items-end gap-2 ${estMoi ? 'justify-end' : ''}`}>
            {!estMoi && <Initiale pseudo={auteur?.pseudo ?? null} />}
            <div className={`flex max-w-[80%] flex-col ${estMoi ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${estMoi ? 'rounded-br-md' : 'rounded-bl-md'}`}
                style={estMoi ? { background: '#6D28D9', color: '#FFFFFF' } : { background: '#F3F4F6', color: '#1F2937' }}
              >
                <div className="whitespace-pre-wrap break-words">
                  <MathText text={m.contenu} />
                </div>
                {m.image_url && (
                  <button
                    type="button"
                    onClick={() => setImageAgrandie(m.image_url)}
                    aria-label="Agrandir l'image"
                    className="mt-2 block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image_url} alt="" className="max-h-56 rounded-lg object-contain" />
                  </button>
                )}
              </div>
              <p className="mt-1 px-1 text-[11px] text-text-muted">
                {nom}
                {auteur?.role === 'admin' && !estMoi ? ' (prof)' : ''} · {quand}
              </p>
            </div>
          </div>
        )
      })}

      {imageAgrandie && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageAgrandie(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image agrandie"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageAgrandie} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}

// Bas d'une conversation : « ✓ Résolu » pour l'auteur et barre de réponse
// tant que la question est ouverte ; sinon « Question résolue ».
function BasDeConversation({ ticket, fil, userId }: { ticket: ForumTicket; fil: FilQuestions; userId: string }) {
  const [resolution, setResolution] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  if (ticket.statut === 'ferme') {
    return (
      <p className="shrink-0 border-t border-border px-4 py-3 text-center text-sm font-medium text-success">
        Question résolue
      </p>
    )
  }

  async function resoudre() {
    setResolution(true)
    setErreur(null)
    const err = await fil.resoudre(ticket.id)
    setResolution(false)
    if (err) setErreur(err)
  }

  return (
    <>
      {ticket.user_id === userId && (
        <div className="shrink-0 px-4 pb-2">
          {erreur && <p className="mb-1 text-xs text-danger">{erreur}</p>}
          <button
            type="button"
            onClick={resoudre}
            disabled={resolution}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors disabled:opacity-50"
            style={{ background: '#DCFCE7', color: '#15803D' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {resolution ? 'Fermeture…' : 'Résolu'}
          </button>
        </div>
      )}
      <BarreEnvoi
        key={ticket.id}
        placeholder="Écrire un message…"
        onEnvoyer={(texte, image) => fil.repondre(ticket.id, texte, image)}
      />
    </>
  )
}

// Barre d'envoi en bas du volet : photo (44 px), champ, envoyer (Composer du
// forum, variante 44 px). onEnvoyer renvoie un message d'erreur ou null.
function BarreEnvoi({
  placeholder,
  onEnvoyer,
}: {
  placeholder: string
  onEnvoyer: (texte: string, image: File | null) => Promise<string | null>
}) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function envoyer(texte: string, image: File | null): Promise<boolean> {
    setEnvoi(true)
    setErreur(null)
    const err = await onEnvoyer(texte, image)
    setEnvoi(false)
    setErreur(err)
    return err === null
  }

  return (
    <div
      className="flex shrink-0 border-t border-border bg-surface px-3 pt-2.5"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      <Composer sending={envoi} error={erreur} onSend={envoyer} placeholder={placeholder} variante="fil" />
    </div>
  )
}

// Remplace la barre d'envoi quand l'élève a déjà une question ouverte ailleurs.
function Blocage({
  question,
  titreFeuille,
}: {
  question: NonNullable<FilQuestions['questionOuverte']>
  titreFeuille: string | null
}) {
  const reference =
    question.sujet === 'probleme' && question.numero_exercice != null
      ? ` (Exercice ${question.numero_exercice}${titreFeuille ? ` · ${titreFeuille}` : ''})`
      : ''
  return (
    <div
      className="shrink-0 border-t border-border bg-surface px-4 pt-3 text-sm text-text-primary"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <p className="rounded-xl bg-accent/5 px-3 py-2.5">
        Tu as déjà une question ouverte{reference}. Marque-la résolue pour en poser une nouvelle.{' '}
        <Link href={`/forum/question/${question.id}`} className="font-semibold text-accent hover:underline">
          Ouvrir ma question
        </Link>
      </p>
    </div>
  )
}

function Initiale({ pseudo }: { pseudo: string | null }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent"
    >
      {pseudo?.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

function IconeBulle() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
