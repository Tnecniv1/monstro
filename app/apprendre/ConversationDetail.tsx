'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MathText from '../components/MathText'
import type { ConversationSujet, ConversationSoumission } from './ConversationTab'

interface Props {
  userId: string
  sujet: ConversationSujet
  soumission: ConversationSoumission | null
  onSaved: (soumission: ConversationSoumission) => void
  onExit: () => void
}

function construirePrompt(sujet: ConversationSujet) {
  return `Applique strictement la méthode socratique pour m'apprendre à ${sujet.sujet}. ${sujet.regles} L'objectif final de la conversation est de ${sujet.objectif}.`
}

export default function ConversationDetail({ userId, sujet, soumission, onSaved, onExit }: Props) {
  const supabase = createClient()

  const [lien, setLien] = useState(soumission?.lien ?? '')
  const [resultatChoisi, setResultatChoisi] = useState<'succes' | 'echec' | null>(soumission?.resultat ?? null)
  const [copie, setCopie] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [resultatActuel, setResultatActuel] = useState<'succes' | 'echec' | null>(soumission?.resultat ?? null)

  const prompt = construirePrompt(sujet)

  async function copierPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  async function envoyer() {
    if (!lien.trim() || !resultatChoisi || envoi) return
    setEnvoi(true)

    const { data, error } = await supabase
      .from('conversation_soumission')
      .upsert(
        {
          user_id: userId,
          sujet_id: sujet.id,
          lien,
          resultat: resultatChoisi,
        },
        { onConflict: 'user_id,sujet_id' }
      )
      .select('id, user_id, sujet_id, lien, resultat, soumis_le')
      .single()

    setEnvoi(false)

    if (error || !data) {
      console.error('[ConversationDetail] erreur envoi:', error)
      return
    }

    const nouvelleSoumission = data as ConversationSoumission
    setResultatActuel(nouvelleSoumission.resultat)
    onSaved(nouvelleSoumission)
  }

  return (
    <div className="space-y-5">
      <button onClick={onExit} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Sujets
      </button>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">{sujet.titre}</h2>
        {resultatActuel && (
          <span
            className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
              resultatActuel === 'succes' ? 'bg-[#4ade80]/20 text-green-800' : 'bg-[#F5C77E]/40 text-orange-800'
            }`}
          >
            {resultatActuel === 'succes' ? 'Succès ✓' : 'Échec'}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        <MathText text={prompt} />
      </div>

      <button
        onClick={copierPrompt}
        className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
      >
        {copie ? 'Copié !' : 'Copier le prompt'}
      </button>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Colle ici le lien de ta conversation</label>
        <input
          type="url"
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="https://claude.ai/share/…"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Résultat</label>
        <div className="flex gap-2">
          <button
            onClick={() => setResultatChoisi('succes')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              resultatChoisi === 'succes'
                ? 'bg-[#4ade80] border-[#4ade80] text-gray-900'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            Succès
          </button>
          <button
            onClick={() => setResultatChoisi('echec')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              resultatChoisi === 'echec'
                ? 'bg-[#F5C77E] border-[#F5C77E] text-gray-900'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            Échec
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={envoyer}
          disabled={!lien.trim() || !resultatChoisi || envoi}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Envoyer
        </button>
      </div>
    </div>
  )
}
