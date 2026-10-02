'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import MathText from '../components/MathText'
import KebabMenu from './KebabMenu'
import { formatHeure, jourParis, libelleJour } from './relativeTime'
import type { ForumMessage } from './types'

interface Props {
  messages: ForumMessage[]
  pseudos: Map<string, string>
  userId: string
  isAdmin: boolean
  loading: boolean
  onDeleteMessage: (messageId: string) => void
}

// Marge sous laquelle on considère l'utilisateur "en bas" de la conversation.
const SEUIL_BAS_PX = 80

export default function MessageList({ messages, pseudos, userId, isAdmin, loading, onDeleteMessage }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Suivi de la position : une image chargée après coup ne ramène en bas que
  // si l'utilisateur y était déjà (sinon on ne bouge pas sa lecture).
  const enBasRef = useRef(true)
  const [imageAgrandie, setImageAgrandie] = useState<string | null>(null)

  function allerEnBas() {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  // À l'ouverture (fin du chargement) et à chaque nouveau message (envoi) :
  // défilement vers le dernier. Une suppression (longueur qui baisse) ne
  // fait pas défiler.
  const nbPrecedent = useRef(0)
  useLayoutEffect(() => {
    if (loading) {
      nbPrecedent.current = 0
      return
    }
    if (messages.length > nbPrecedent.current) {
      allerEnBas()
      enBasRef.current = true
    }
    nbPrecedent.current = messages.length
  }, [loading, messages.length])

  useEffect(() => {
    if (!imageAgrandie) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setImageAgrandie(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [imageAgrandie])

  function onScroll() {
    const el = scrollRef.current
    if (el) enBasRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_BAS_PX
  }

  function onImageLoad() {
    if (enBasRef.current) allerEnBas()
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
      {loading && <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>}

      {!loading && messages.length === 0 && <p className="py-8 text-center text-sm text-text-muted">Aucun message.</p>}

      {!loading &&
        messages.map((m, i) => {
          const precedent = messages[i - 1]
          const jour = jourParis(m.created_at)
          const nouveauJour = !precedent || jourParis(precedent.created_at) !== jour
          // Groupe : même auteur, même jour (un séparateur coupe toujours le groupe).
          const debutGroupe = nouveauJour || precedent.user_id !== m.user_id
          const estMoi = m.user_id === userId
          const peutSupprimer = estMoi || isAdmin

          return (
            <Fragment key={m.id}>
              {nouveauJour && (
                <div className="my-4 flex justify-center first:mt-0">
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text-muted">
                    {libelleJour(jour)}
                  </span>
                </div>
              )}

              <div
                className={`group flex items-center gap-1 ${estMoi ? 'flex-row-reverse' : ''} ${
                  debutGroupe && !nouveauJour && i > 0 ? 'mt-3' : 'mt-0.5'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    estMoi
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-text-primary'
                  }`}
                >
                  {!estMoi && debutGroupe && (
                    <p className="mb-0.5 text-xs font-semibold text-accent">{pseudos.get(m.user_id) ?? '—'}</p>
                  )}
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
                      <img
                        src={m.image_url}
                        alt=""
                        onLoad={onImageLoad}
                        className="max-h-64 rounded-lg object-contain"
                      />
                    </button>
                  )}
                  <p className={`mt-0.5 text-right text-[10px] tabular-nums ${estMoi ? 'text-white/70' : 'text-text-muted'}`}>
                    {formatHeure(m.created_at)}
                  </p>
                </div>

                {peutSupprimer && (
                  <KebabMenu
                    label="Actions du message"
                    align={estMoi ? 'right' : 'left'}
                    buttonClassName="h-7 w-7 opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                    items={[{ label: 'Supprimer le message', danger: true, onClick: () => onDeleteMessage(m.id) }]}
                  />
                )}
              </div>
            </Fragment>
          )
        })}

      {imageAgrandie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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
