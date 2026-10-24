import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/getUser'
import ForumClient from './ForumClient'
import { isForumAdmin } from './adminGate'
import { TOPICS_MASQUES, problemeHref } from './types'
import type { Feuille, FiltreProblemes, ForumScript, ForumTicket, ForumTopic, InitialTicket } from './types'

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
  // chargement. Un ticket de topic de sens s'ouvre dans son onglet ; une
  // question du forum mène à sa page (celle de son problème s'il est numéroté).
  const ticketParam = Array.isArray(searchParams.ticket) ? searchParams.ticket[0] : searchParams.ticket
  const ticketId = ticketParam && /^[0-9a-f-]{36}$/i.test(ticketParam) ? ticketParam : null

  // ?filtre=<mes|toutes|feuilleId> : filtre de la grille des problèmes (absent
  // = mes) ; présent et valide, il ouvre l'onglet Problèmes.
  const filtreParam = Array.isArray(searchParams.filtre) ? searchParams.filtre[0] : searchParams.filtre

  // ?onglet=ressources (ancien onglet Ressources) : les ressources sont
  // devenues les cours de la Bibliothèque.
  if (searchParams.onglet === 'ressources') redirect('/bibliotheque?vue=cours')

  // ?onglet=equipe (compteur de jetons ADN de l'accueil) : ouvre l'onglet Équipe.
  const ouvrirEquipe = searchParams.onglet === 'equipe'

  const [
    { data: scriptsData },
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
    supabase
      .from('forum_topics')
      .select('id, nom, ordre, display_mode')
      .order('ordre'),
    // Toutes les feuilles — référence des questions et grille des problèmes
    // (numéros 1 à volume).
    supabase
      .from('feuille_entrainement')
      .select('id, titre, volume'),
    // Même table que le Focus du Kanban (app/entrainement/KanbanFeuilles.tsx).
    supabase
      .from('feuille_focus')
      .select('feuille_id')
      .eq('user_id', user.id)
      .order('created_at'),
    // Onboarding : le modal "avant le Script 1" ne s'affiche qu'une fois.
    supabase
      .from('user_profile')
      .select('script1_ouvert_at')
      .eq('id', user.id)
      .single(),
    ticketId
      ? supabase
          .from('forum_tickets')
          .select('id, topic_id, sujet, feuille_id, numero_exercice')
          .eq('id', ticketId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const scripts = (scriptsData ?? []) as ForumScript[]
  // Sans les topics masqués ni ceux en display_mode 'resources' (le topic
  // Ressources, dont les fiches sont les cours de la Bibliothèque). Rien n'est
  // supprimé en base : monstro-expo affiche encore l'onglet Ressources.
  const topicsSens = ((topicsData ?? []) as ForumTopic[]).filter(
    (t) => !TOPICS_MASQUES.includes(t.id) && t.display_mode !== 'resources'
  )
  // ?ticket= d'un topic sans onglet : ignoré, le Forum s'ouvre sur son onglet par défaut.
  const ticketDemande = initialTicketData as
    | (InitialTicket & Pick<ForumTicket, 'sujet' | 'feuille_id' | 'numero_exercice'>)
    | null
  if (ticketDemande && ticketDemande.topic_id == null) {
    redirect(
      ticketDemande.sujet === 'probleme' && ticketDemande.feuille_id && ticketDemande.numero_exercice != null
        ? problemeHref(ticketDemande.feuille_id, ticketDemande.numero_exercice)
        : `/forum/question/${ticketDemande.id}`
    )
  }
  const initialTicket =
    ticketDemande?.topic_id && !topicsSens.some((t) => t.id === ticketDemande.topic_id) ? null : ticketDemande
  const feuilles = ((feuillesData ?? []) as Feuille[])
    .slice()
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
  // Dans l'ordre de mise en Focus (pastilles de la grille des problèmes).
  const focusIds = (focusData ?? []).map((f) => f.feuille_id as string)

  // Une feuille n'est un filtre valide que si elle est en Focus.
  const initialFiltre: FiltreProblemes | null =
    filtreParam === 'mes' || filtreParam === 'toutes' || (filtreParam && focusIds.includes(filtreParam))
      ? filtreParam
      : null

  return (
    // Une seule zone de défilement : la page (aucun conteneur à hauteur
    // d'écran ni overflow vertical dans le Forum).
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-5">
        <Link href="/" className="shrink-0 self-start text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>

        <ForumClient
          scripts={scripts}
          topicsSens={topicsSens}
          feuilles={feuilles}
          focusIds={focusIds}
          script1Ouvert={onboardingData?.script1_ouvert_at != null}
          autoOpenScriptOrdre={autoOpenScriptOrdre}
          initialTicket={initialTicket ?? null}
          ouvrirEquipe={ouvrirEquipe}
          initialFiltre={initialFiltre}
          userId={user.id}
          isAdmin={isForumAdmin(profile?.role)}
        />
      </div>
    </div>
  )
}
