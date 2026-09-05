'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MathText from '../components/MathText'
import type { ConversationSujet, ConversationSoumission } from './ConversationTab'
import {
  compterMessagesDuSet,
  MARQUEUR_ECHEC,
  MARQUEUR_PREFIXE,
  MARQUEUR_SUCCES,
  MESSAGE_AMORCE,
  TAILLE_SET,
} from '@/lib/anthropic/tentative'

interface Props {
  userId: string
  sujet: ConversationSujet
  soumission: ConversationSoumission | null
  onSaved: (soumission: ConversationSoumission) => void
  onExit: () => void
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  contenu: string
}

type Verdict = { verdict: 'succes' | 'echec'; justification: string }

/**
 * Texte à afficher à l'étudiant : retire le marqueur de tentative complet
 * s'il est déjà arrivé (avec le saut de ligne qui le précède), ou masque un
 * préfixe de marqueur en cours d'arrivée en fin de texte pendant le
 * streaming, pour qu'il n'apparaisse jamais brièvement en clair.
 */
function texteAffichable(texteBrut: string): string {
  const marqueurComplet = [MARQUEUR_SUCCES, MARQUEUR_ECHEC].find((m) => texteBrut.includes(m))
  if (marqueurComplet) {
    return texteBrut.slice(0, texteBrut.indexOf(marqueurComplet)).replace(/\n+$/, '')
  }

  for (let longueur = Math.min(MARQUEUR_PREFIXE.length, texteBrut.length); longueur > 0; longueur--) {
    const suffixe = texteBrut.slice(-longueur)
    if (MARQUEUR_PREFIXE.startsWith(suffixe)) {
      return texteBrut.slice(0, -longueur).replace(/\n+$/, '')
    }
  }

  return texteBrut
}

export default function ConversationDetail({ userId, sujet, soumission, onSaved, onExit }: Props) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [texteStream, setTexteStream] = useState('')
  const [termine, setTermine] = useState(!!soumission?.resultat)
  const [verdict, setVerdict] = useState<Verdict | null>(
    soumission?.resultat ? { verdict: soumission.resultat, justification: '' } : null
  )
  const [erreur, setErreur] = useState<string | null>(null)

  const demarrageDeclencheRef = useRef(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let annule = false

    async function charger() {
      setLoading(true)
      const { data, error } = await supabase
        .from('conversation_message')
        .select('id, role, contenu')
        .eq('user_id', userId)
        .eq('sujet_id', sujet.id)
        .order('created_at')

      if (annule) return

      if (error) {
        console.error('[ConversationDetail] erreur chargement historique:', error)
        setErreur('Erreur de connexion, réessaie.')
        setLoading(false)
        return
      }

      const historique = (data ?? []) as ChatMessage[]
      setMessages(historique)
      setLoading(false)

      if (historique.length === 0 && !termine && !demarrageDeclencheRef.current) {
        demarrageDeclencheRef.current = true
        envoyer(MESSAGE_AMORCE, { silencieux: true })
      }
    }

    charger()
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sujet.id])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, texteStream])

  async function envoyer(contenu: string, opts: { silencieux?: boolean } = {}) {
    const texte = contenu.trim()
    if (!texte || streaming || termine) return

    setErreur(null)
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', contenu: texte }])
    if (!opts.silencieux) setInput('')
    setStreaming(true)
    setTexteStream('')

    try {
      const res = await fetch('/api/socratique/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujetId: sujet.id, message: texte }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Réponse HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assemble = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        assemble += decoder.decode(value, { stream: true })
        setTexteStream(assemble)
      }

      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', contenu: assemble }])

      // Tentative réussie ce tour : la route API a déjà enregistré le succès
      // en base (conversation_soumission) — on relit la ligne pour notifier
      // le parent (recoloration de la grille des sujets) et verrouiller le
      // chat en lecture seule.
      if (assemble.includes(MARQUEUR_SUCCES)) {
        setVerdict({ verdict: 'succes', justification: '' })
        setTermine(true)

        const { data: soumissionMaj, error: soumissionError } = await supabase
          .from('conversation_soumission')
          .select('id, user_id, sujet_id, lien, resultat, soumis_le')
          .eq('user_id', userId)
          .eq('sujet_id', sujet.id)
          .single()

        if (soumissionError || !soumissionMaj) {
          console.error('[ConversationDetail] erreur relecture soumission:', soumissionError)
        } else {
          onSaved(soumissionMaj as ConversationSoumission)
        }
      }
    } catch (error) {
      console.error('[ConversationDetail] erreur envoi message:', error)
      setErreur('Erreur de connexion, réessaie.')
    } finally {
      setStreaming(false)
      setTexteStream('')
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    envoyer(input)
  }

  const messagesAffiches = messages.filter(
    (m, i) => !(i === 0 && m.role === 'user' && m.contenu === MESSAGE_AMORCE)
  )

  // Pastille "Tentative N : succès/échec" affichée après chaque message
  // assistant qui contient un marqueur, numérotée en comptant les tentatives
  // précédentes de cette conversation.
  let compteurTentatives = 0
  const infosTentative = messagesAffiches.map((m) => {
    if (m.role !== 'assistant') return null
    if (m.contenu.includes(MARQUEUR_SUCCES)) {
      compteurTentatives += 1
      return { type: 'succes' as const, numero: compteurTentatives }
    }
    if (m.contenu.includes(MARQUEUR_ECHEC)) {
      compteurTentatives += 1
      return { type: 'echec' as const, numero: compteurTentatives }
    }
    return null
  })

  const messagesDansSet = compterMessagesDuSet(messages)
  const texteStreamAffichable = texteAffichable(texteStream)

  return (
    <div className="space-y-4">
      <button onClick={onExit} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Sujets
      </button>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">{sujet.titre}</h2>
        {verdict && (
          <span
            className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
              verdict.verdict === 'succes' ? 'bg-[#4ade80]/20 text-green-800' : 'bg-[#F5C77E]/40 text-orange-800'
            }`}
          >
            {verdict.verdict === 'succes' ? 'Succès ✓' : 'Échec'}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-[#a78bfa]/40 bg-[#a78bfa]/10 p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objectif</p>
        <p className="text-sm text-gray-800 leading-relaxed mt-0.5">
          <MathText text={sujet.objectif} />
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white flex flex-col h-[420px] overflow-y-auto p-4 space-y-3">
        {loading && <p className="text-center text-sm text-gray-400 py-8">Chargement…</p>}

        {!loading &&
          messagesAffiches.map((m, i) => {
            const info = infosTentative[i]
            return (
              <div key={m.id} className="space-y-2">
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <MathText text={texteAffichable(m.contenu)} />
                  </div>
                </div>

                {info && (
                  <div className="flex justify-center">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full ${
                        info.type === 'succes'
                          ? 'bg-[#4ade80]/20 text-green-800'
                          : 'bg-[#F5C77E]/40 text-orange-800'
                      }`}
                    >
                      {info.type === 'succes'
                        ? `🎉 Tentative ${info.numero} : succès`
                        : `⚠️ Tentative ${info.numero} : échec`}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-gray-100 text-gray-900">
              {texteStreamAffichable ? <MathText text={texteStreamAffichable} /> : <span className="text-gray-400">…</span>}
            </div>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {erreur && (
        <div className="rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm font-medium text-center">{erreur}</div>
      )}

      {!termine && (
        <form onSubmit={onSubmit} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming || loading}
              placeholder="Écris ta réponse…"
              className="flex-1 rounded-xl border border-gray-200 p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || loading || !input.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Envoyer
            </button>
          </div>
          {!loading && <p className="text-xs text-gray-400 text-right">{messagesDansSet}/{TAILLE_SET} avant tentative</p>}
        </form>
      )}
    </div>
  )
}
