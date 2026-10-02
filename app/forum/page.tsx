import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import ForumClient from './ForumClient'
import { isForumAdmin } from './adminGate'
import type { Feuille, ForumResource, ForumScript, ForumTopic, InitialTicket } from './types'

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

  // ?ticket=<id> (liens, notifications) : sélectionne la question au
  // chargement. Son topic_id indique l'onglet à ouvrir.
  const ticketParam = Array.isArray(searchParams.ticket) ? searchParams.ticket[0] : searchParams.ticket
  const ticketId = ticketParam && /^[0-9a-f-]{36}$/i.test(ticketParam) ? ticketParam : null

  const [
    { data: scriptsData },
    { data: resourcesData },
    { data: topicsData },
    { data: feuillesData },
    { data: focusData },
    { data: onboardingData },
    { data: initialTicketData },
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
    ticketId
      ? supabase.from('forum_tickets').select('id, topic_id').eq('id', ticketId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const scripts = (scriptsData ?? []) as ForumScript[]
  const resources = (resourcesData ?? []) as ForumResource[]
  const topicsSens = (topicsData ?? []) as ForumTopic[]
  const feuilles = ((feuillesData ?? []) as Feuille[])
    .slice()
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  const focusIds = (focusData ?? []).map((f) => f.feuille_id as string)

  return (
    // ≥ md : la page tient dans l'écran (la vue messagerie prend la hauteur
    // restante, chaque colonne défile seule). Si l'écran est trop bas pour
    // la hauteur minimale de la messagerie, c'est ce conteneur qui défile.
    <div className="min-h-screen bg-bg md:h-dvh md:min-h-0 md:overflow-y-auto">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 px-4 py-6 md:h-full">
        <Link href="/" className="shrink-0 self-start text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>

        <ForumClient
          scripts={scripts}
          resources={resources}
          topicsSens={topicsSens}
          feuilles={feuilles}
          focusIds={focusIds}
          script1Ouvert={onboardingData?.script1_ouvert_at != null}
          autoOpenScriptOrdre={autoOpenScriptOrdre}
          initialTicket={(initialTicketData as InitialTicket | null) ?? null}
          userId={user.id}
          isAdmin={isForumAdmin(profile?.role)}
        />
      </div>
    </div>
  )
}
