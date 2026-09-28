import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import ForumClient from './ForumClient'
import { isForumAdmin } from './adminGate'
import type { Feuille, ForumResource, ForumScript, ForumTopic } from './types'

export default async function ForumPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const { user, profile } = await getUser()
  const supabase = createClient()

  // ?script=N (ex. lien "Voir le Script 1" de l'onboarding) : ouvre le
  // script d'ordre N au chargement.
  const scriptParam = Number(Array.isArray(searchParams.script) ? searchParams.script[0] : searchParams.script)
  const autoOpenScriptOrdre = Number.isInteger(scriptParam) && scriptParam >= 1 ? scriptParam : null

  const [
    { data: scriptsData },
    { data: resourcesData },
    { data: topicsData },
    { data: feuillesData },
    { data: focusData },
    { data: onboardingData },
  ] = await Promise.all([
    supabase
      .from('forum_scripts')
      .select('id, titre, description, citation, etapes, cover_url, ordre')
      .order('ordre'),
    // Ressources — affichées à la place des tickets pour tout topic "de sens"
    // avec display_mode === 'resources' (aujourd'hui : le topic Ressources).
    supabase
      .from('forum_resources')
      .select('id, titre, description, cover_url, pdf_url, ordre')
      .order('ordre'),
    supabase
      .from('forum_topics')
      .select('id, nom, ordre, display_mode')
      .order('ordre'),
    // Toutes les feuilles — choix de la feuille d'une question Problème et
    // référence affichée dans la liste des questions.
    supabase
      .from('feuille_entrainement')
      .select('id, titre'),
    // Même table que le Focus du Kanban (app/entrainement/KanbanFeuilles.tsx).
    supabase
      .from('feuille_focus')
      .select('feuille_id')
      .eq('user_id', user.id),
    // Onboarding : le modal "avant le Script 1" ne s'affiche qu'une fois.
    supabase
      .from('user_profile')
      .select('script1_ouvert_at')
      .eq('id', user.id)
      .single(),
  ])

  const scripts = (scriptsData ?? []) as ForumScript[]
  const resources = (resourcesData ?? []) as ForumResource[]
  const topicsSens = (topicsData ?? []) as ForumTopic[]
  const feuilles = ((feuillesData ?? []) as Feuille[])
    .slice()
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  const focusIds = (focusData ?? []).map((f) => f.feuille_id as string)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>

        <ForumClient
          scripts={scripts}
          resources={resources}
          topicsSens={topicsSens}
          feuilles={feuilles}
          focusIds={focusIds}
          script1Ouvert={onboardingData?.script1_ouvert_at != null}
          autoOpenScriptOrdre={autoOpenScriptOrdre}
          userId={user.id}
          isAdmin={isForumAdmin(profile?.role)}
        />
      </div>
    </div>
  )
}
