import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import { isForumAdmin } from '../adminGate'
import { filtreDepuis } from '../types'
import type { Feuille, ForumScript } from '../types'
import FaqClient from './FaqClient'

// FAQ du forum : questions Méthode et Application, et anciennes questions
// Problème sans numéro. Épinglées en tête, puis toutes les autres.
export default async function FaqPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const { user, profile } = await getUser()
  const supabase = createClient()

  const [{ data: feuillesData }, { data: scriptsData }, { data: focusData }] = await Promise.all([
    // Référence des questions Problème sans numéro, et formulaire « + Question ».
    supabase.from('feuille_entrainement').select('id, titre, volume'),
    // Référence des questions Méthode (#ordre titre), et formulaire.
    supabase.from('forum_scripts').select('id, titre, description, citation, etapes, cover_url, ordre').order('ordre'),
    supabase.from('feuille_focus').select('feuille_id').eq('user_id', user.id).order('created_at'),
  ])

  const feuilles = ((feuillesData ?? []) as Feuille[]).slice().sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  const scripts = (scriptsData ?? []) as ForumScript[]
  const focusIds = (focusData ?? []).map((f) => f.feuille_id as string)

  // ?depuis= : filtre de la grille d'où l'on vient ; explicite dans l'URL du
  // retour, pour rouvrir l'onglet Problèmes.
  const depuis = filtreDepuis(searchParams.depuis)

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[760px] space-y-5 px-4 py-5">
        <Link
          href={`/forum?filtre=${encodeURIComponent(depuis)}`}
          className="-ml-2 inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          ‹ Tous les problèmes
        </Link>

        <FaqClient
          userId={user.id}
          isAdmin={isForumAdmin(profile?.role)}
          feuilles={feuilles}
          focusIds={focusIds}
          scripts={scripts}
        />
      </div>
    </div>
  )
}
