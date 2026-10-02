'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import MathText from '../components/MathText'

interface Props {
  sending: boolean
  error: string | null
  // Renvoie true si l'envoi a réussi (le champ est alors vidé).
  onSend: (texte: string, image: File | null) => Promise<boolean>
}

// Hauteur max du champ (~5 lignes), au-delà il défile.
const HAUTEUR_MAX_PX = 120

// Barre de saisie fixée en bas de la conversation.
export default function Composer({ sending, error, onSend }: Props) {
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Le champ s'agrandit avec le texte, jusqu'à HAUTEUR_MAX_PX.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, HAUTEUR_MAX_PX)}px`
  }, [input])

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

  async function envoyer() {
    const texte = input.trim()
    if (!texte || sending) return
    const ok = await onSend(texte, imageFile)
    if (ok) {
      setInput('')
      clearImage()
      // Après le rendu qui réactive le champ (désactivé pendant l'envoi).
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  // Ordinateur (pointeur précis) : Entrée envoie, Maj+Entrée va à la ligne.
  // Écran tactile : Entrée va toujours à la ligne (envoi par le bouton).
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    e.preventDefault()
    envoyer()
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3 py-2.5 sm:px-4">
      {input.includes('$') && (
        <div className="mb-2 max-h-24 overflow-y-auto rounded-xl bg-surface-2 px-3 py-1.5 text-sm text-text-primary whitespace-pre-wrap break-words">
          <MathText text={input} />
        </div>
      )}

      {imagePreviewUrl && (
        <div className="relative mb-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreviewUrl} alt="" className="max-h-24 rounded-lg border border-border" />
          <button
            type="button"
            onClick={clearImage}
            aria-label="Retirer l'image"
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      <div className="flex items-end gap-2">
        <label
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text-secondary transition-colors"
          aria-label="Ajouter une image"
          title="Ajouter une image"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={sending}
            className="hidden"
          />
        </label>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
          placeholder="Écris ta réponse… ($...$ pour les maths)"
          className="min-h-[40px] flex-1 resize-none rounded-[20px] border border-border bg-surface-2 px-4 py-2.5 text-sm leading-5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        />

        <button
          type="button"
          onClick={envoyer}
          disabled={sending || !input.trim()}
          aria-label="Envoyer"
          title="Envoyer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
