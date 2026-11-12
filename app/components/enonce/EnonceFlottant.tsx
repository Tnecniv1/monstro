'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { ExerciceEnCours } from '@/lib/exerciceEnCours'
import { useForumAttente } from '../ForumAttenteProvider'

// Panneau et pdf.js chargés seulement quand l'élève ouvre l'énoncé : rien de
// plus à télécharger pour l'accueil.
const PanneauEnonce = dynamic(() => import('./PanneauEnonce'), { ssr: false })

// Énoncé flottant (accueil et /entrainement) : pastille au-dessus de la barre
// d'onglets tant qu'un exercice est en cours (lib/exerciceEnCours.ts) ;
// toucher l'ouvre en panneau Énoncé | Correction | Forum. Rien sans exercice
// en cours. Réponse non lue sur la question de l'élève pour cet exercice :
// point rouge sur la pastille, et le panneau s'ouvre sur le volet Forum.
export default function EnonceFlottant({ exercice, userId }: { exercice: ExerciceEnCours | null; userId: string }) {
  const [ouvert, setOuvert] = useState(false)
  const nonLus = useNonLusExercice(exercice, userId, ouvert)
  if (!exercice) return null

  return (
    <>
      {/* Réserve la place de la pastille en bas du contenu. */}
      <div aria-hidden className="h-[72px]" />

      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={
            nonLus > 0
              ? `Exercice ${exercice.exo}, ${exercice.titre} : nouvelle réponse sur ta question`
              : `Exercice ${exercice.exo}, ${exercice.titre} : lire l’énoncé`
          }
          className="fixed inset-x-4 z-40 flex h-14 items-center gap-3 rounded-2xl px-2 text-left shadow-[0_8px_24px_rgba(31,18,53,0.35)] md:inset-x-auto md:right-4 md:w-[360px]"
          style={{ background: '#1F1235', bottom: 'calc(56px + env(safe-area-inset-bottom) + 16px)' }}
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: '#6D28D9' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </svg>
            {nonLus > 0 && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2"
                style={{ background: '#DC2626', borderColor: '#1F1235' }}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">Exercice {exercice.exo}</span>
            <span className="block truncate text-xs" style={{ color: '#C4B5FD' }}>
              {nonLus > 0 ? 'Nouvelle réponse sur ta question' : `${exercice.titre} · toucher pour lire`}
            </span>
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </span>
        </button>
      )}

      {ouvert && (
        <PanneauEnonce
          exercice={exercice}
          userId={userId}
          nbNonLus={nonLus}
          ongletInitial={nonLus > 0 ? 'forum' : 'enonce'}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  )
}

// Messages non lus sur la question de l'élève pour cet exercice. Même règle
// que la RPC forum_tickets_en_attente (ForumAttenteProvider) : question
// ouverte, messages des autres postérieurs à la lecture (forum_lecture.lu_le).
// La RPC dit si la question est en attente ; le nombre est compté ici.
// Recalculé quand la liste en attente change (lecture dans le volet Forum,
// changement de route) et à l'ouverture / fermeture du panneau.
function useNonLusExercice(exercice: ExerciceEnCours | null, userId: string, ouvert: boolean): number {
  const { ids } = useForumAttente()
  const [nonLus, setNonLus] = useState(0)
  const feuilleId = exercice?.feuilleId ?? null
  const exo = exercice?.exo ?? null

  useEffect(() => {
    if (!feuilleId || exo == null || ids.size === 0) {
      setNonLus(0)
      return
    }
    let annule = false
    async function compter() {
      const supabase = createClient()
      const { data: tickets } = await supabase
        .from('forum_tickets')
        .select('id')
        .is('topic_id', null)
        .eq('sujet', 'probleme')
        .eq('user_id', userId)
        .eq('feuille_id', feuilleId!)
        .eq('numero_exercice', exo!)
        .eq('statut', 'ouvert')
      const enAttente = ((tickets ?? []) as { id: string }[]).map((t) => t.id).filter((id) => ids.has(id))
      if (enAttente.length === 0) {
        if (!annule) setNonLus(0)
        return
      }
      const { data: lectures } = await supabase
        .from('forum_lecture')
        .select('ticket_id, lu_le')
        .eq('user_id', userId)
        .in('ticket_id', enAttente)
      const luLe = new Map(((lectures ?? []) as { ticket_id: string; lu_le: string }[]).map((l) => [l.ticket_id, l.lu_le]))
      let total = 0
      for (const id of enAttente) {
        let requete = supabase
          .from('forum_messages')
          .select('id', { count: 'exact', head: true })
          .eq('ticket_id', id)
          .neq('user_id', userId)
        const lu = luLe.get(id)
        if (lu) requete = requete.gt('created_at', lu)
        const { count } = await requete
        total += count ?? 0
      }
      // En attente pour la RPC : au moins 1, même si le comptage échoue.
      if (!annule) setNonLus(Math.max(total, 1))
    }
    compter()
    return () => {
      annule = true
    }
  }, [feuilleId, exo, userId, ids, ouvert])

  return nonLus
}
