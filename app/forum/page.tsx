import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import ForumClient from './ForumClient'
import { isForumAdmin } from './adminGate'
import type { FeuilleTopic, ForumResource, ForumScript, ForumTopic } from './types'

export default async function ForumPage() {
  const { user, profile } = await getUser()
  const supabase = createClient()

  const [
    { data: scriptsData },
    { data: resourcesData },
    { data: topicsData },
    { data: feuillesData },
    { data: focusData },
    { data: pinsData },
    { data: ticketFeuillesData },
  ] = await Promise.all([
    supabase
      .from('forum_scripts')
      .select('id, titre, description, contenu, pdf_url, cover_url, ordre')
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
    // Topics "de travail" — mêmes feuilles que la Bibliothèque (app/bibliotheque/page.tsx),
    // affichées ici à plat (un topic par feuille), sans la hiérarchie de nœuds.
    // La liste complète sert aussi de source au picker d'épinglage.
    supabase
      .from('feuille_entrainement')
      .select('id, titre'),
    // Même table que le Focus du Kanban (app/entrainement/KanbanFeuilles.tsx).
    supabase
      .from('feuille_focus')
      .select('feuille_id')
      .eq('user_id', user.id),
    supabase
      .from('forum_topic_pins')
      .select('feuille_id')
      .eq('user_id', user.id),
    // Une feuille reste visible tant que l'utilisateur y a un ticket, même
    // retirée du Focus et jamais épinglée.
    supabase
      .from('forum_tickets')
      .select('feuille_id')
      .eq('user_id', user.id)
      .not('feuille_id', 'is', null),
  ])

  const scripts = (scriptsData ?? []) as ForumScript[]
  const resources = (resourcesData ?? []) as ForumResource[]
  const topicsSens = (topicsData ?? []) as ForumTopic[]
  const allFeuilles = ((feuillesData ?? []) as FeuilleTopic[])
    .slice()
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  const focusIds = (focusData ?? []).map((f) => f.feuille_id)
  const pinnedIds = (pinsData ?? []).map((p) => p.feuille_id)
  const ticketFeuilleIds = Array.from(
    new Set((ticketFeuillesData ?? []).map((t) => t.feuille_id as string))
  )

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>

        <ForumClient
          scripts={scripts}
          resources={resources}
          topicsSens={topicsSens}
          allFeuilles={allFeuilles}
          focusIds={focusIds}
          initialPinnedIds={pinnedIds}
          ticketFeuilleIds={ticketFeuilleIds}
          userId={user.id}
          isAdmin={isForumAdmin(profile?.role)}
        />
      </div>
    </div>
  )
}
