'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SUJET_LABEL, TICKET_COLUMNS } from './types'
import type { ActiveTopic, Feuille, ForumScript, ForumTicket, QuestionSujet } from './types'

interface Props {
  activeTopic: ActiveTopic
  userId: string
  feuilles: Feuille[]
  focusIds: string[]
  scripts: ForumScript[]
  // Pré-remplissage (ex. onboarding : ouvrir directement "Méthode, Script #1").
  initialSujet?: QuestionSujet
  initialScriptId?: string
  onClose: () => void
  onCreated: (ticket: ForumTicket) => void
}

const FIELD_CLASS =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'

// Le trigger forum_enforce_one_open_ticket lève une exception (code P0001)
// au vouvoiement quand l'utilisateur a déjà un ticket ouvert — reformulée
// ici au tutoiement pour matcher le reste du forum, plutôt que de laisser
// passer une erreur générique.
function friendlyTicketError(message: string | undefined): string {
  if (!message) return 'Erreur lors de la création du ticket.'
  if (message.toLowerCase().includes('ticket ouvert')) {
    return 'Tu as déjà un ticket ouvert. Ferme-le avant d’en ouvrir un nouveau.'
  }
  return message
}

export default function NouveauTicketModal({
  activeTopic,
  userId,
  feuilles,
  focusIds,
  scripts,
  initialSujet,
  initialScriptId,
  onClose,
  onCreated,
}: Props) {
  const supabase = createClient()
  const isQuestion = activeTopic.kind === 'questions'

  const [sujet, setSujet] = useState<QuestionSujet | null>(initialSujet ?? null)
  const [feuilleId, setFeuilleId] = useState('')
  const [numeroExercice, setNumeroExercice] = useState('')
  const [scriptId, setScriptId] = useState(initialScriptId ?? '')
  const [titre, setTitre] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // feuilles arrive déjà trié alphabétiquement : on sépare Focus / autres.
  const [feuillesFocus, autresFeuilles] = useMemo(() => {
    const focus = new Set(focusIds)
    return [feuilles.filter((f) => focus.has(f.id)), feuilles.filter((f) => !focus.has(f.id))]
  }, [feuilles, focusIds])

  const numero = Number(numeroExercice)
  const numeroValide = Number.isInteger(numero) && numero >= 1

  const questionValide =
    !isQuestion ||
    (sujet !== null && (sujet !== 'probleme' || (feuilleId !== '' && numeroValide)))
  const canSubmit = !loading && !!titre.trim() && !!message.trim() && questionValide

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)

    // Ticket de topic : topic_id seul. Question : topic_id null, sujet +
    // uniquement les colonnes propres au sujet choisi.
    // Pas de `statut` à l'insertion : la colonne prend sa valeur par défaut côté DB.
    const payload =
      activeTopic.kind === 'sens'
        ? { topic_id: activeTopic.id, user_id: userId, titre: titre.trim() }
        : {
            topic_id: null,
            sujet,
            feuille_id: sujet === 'probleme' ? feuilleId : null,
            numero_exercice: sujet === 'probleme' ? numero : null,
            script_id: sujet === 'methode' && scriptId ? scriptId : null,
            user_id: userId,
            titre: titre.trim(),
          }

    const { data: ticket, error: ticketError } = await supabase
      .from('forum_tickets')
      .insert(payload)
      .select(TICKET_COLUMNS)
      .single()

    if (ticketError || !ticket) {
      setError(friendlyTicketError(ticketError?.message))
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
          <h2 className="font-semibold text-text-primary">{isQuestion ? 'Nouvelle question' : 'Nouveau ticket'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary transition-colors text-2xl leading-none p-2 -mr-2"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {isQuestion && (
            <>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Sujet</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SUJET_LABEL) as QuestionSujet[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSujet(s)}
                      aria-pressed={sujet === s}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                        sujet === s
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text-secondary hover:bg-surface-2'
                      }`}
                    >
                      {SUJET_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {sujet === 'probleme' && (
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">Feuille</label>
                    <select
                      value={feuilleId}
                      onChange={(e) => setFeuilleId(e.target.value)}
                      required
                      className={FIELD_CLASS}
                    >
                      <option value="" disabled>Choisis une feuille</option>
                      {feuillesFocus.length > 0 && (
                        <optgroup label="En Focus">
                          {feuillesFocus.map((f) => (
                            <option key={f.id} value={f.id}>{f.titre}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={feuillesFocus.length > 0 ? 'Autres feuilles' : 'Feuilles'}>
                        {autresFeuilles.map((f) => (
                          <option key={f.id} value={f.id}>{f.titre}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="w-24 space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">Exercice</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={numeroExercice}
                      onChange={(e) => setNumeroExercice(e.target.value)}
                      required
                      placeholder="n°"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              )}

              {sujet === 'methode' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">Script (optionnel)</label>
                  <select value={scriptId} onChange={(e) => setScriptId(e.target.value)} className={FIELD_CLASS}>
                    <option value="">Aucun script en particulier</option>
                    {scripts.map((s) => (
                      <option key={s.id} value={s.id}>{`#${s.ordre} ${s.titre}`}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Titre</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              autoFocus={!isQuestion}
              required
              placeholder="Résume ta question en quelques mots"
              className={FIELD_CLASS}
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
              className={`${FIELD_CLASS} resize-none`}
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
            disabled={!canSubmit}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
