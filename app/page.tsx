import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/supabase/getUser'
import PixelGrid from './components/PixelGrid'
import StreakBadge from './components/StreakBadge'
import LogoutButton from './components/LogoutButton'
import MenuProfil from './components/accueil/MenuProfil'
import AvecBarreOnglets from './components/navigation/AvecBarreOnglets'
import LandingPage from './components/LandingPage'
import AccueilParcours from './components/accueil/AccueilParcours'
import ProchaineAction, { type EtatProchaineAction } from './components/accueil/ProchaineAction'
import { chargerParcoursEleve } from '@/lib/parcours/charger'
import { calculerProgression, joursRestants } from '@/lib/parcours/progression'
import { choisirProchaineAction } from '@/lib/parcours/accompagnement'

export const metadata: Metadata = {
  title: 'Monstro — Apprendre à raisonner.',
  description: 'Monstro, la promesse de réussite. Apprendre à raisonner.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Monstro — Apprendre à raisonner.',
    description: 'Monstro, la promesse de réussite. Apprendre à raisonner.',
    url: '/',
    locale: 'fr_FR',
    type: 'website',
    siteName: 'Monstro',
  },
}

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Visiteur non connecté → page d'accueil avec formulaire de connexion
  if (!user) return <LandingPage />

  const { data } = await supabase
    .from('user_profile')
    .select('pseudo, role, avatar_url, confidentiel')
    .eq('id', user.id)
    .single()
  const profile = data as (UserProfile & { confidentiel: boolean | null }) | null

  const pseudo = profile?.pseudo ?? user.email ?? ''
  const isAdmin = profile?.role === 'admin'
  const avatarUrl = profile?.avatar_url ?? null

  const { data: entIds } = await supabase
    .from('entrainement')
    .select('id')
    .eq('user_id', user.id)

  const ids = entIds?.map((e) => e.id) ?? []

  const [{ count }, { data: sessionDates }, parcoursAccueil] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('observation')
          .select('id', { count: 'exact', head: true })
          .in('etat', ['succes', 'corrige'])
          .in('entrainement_id', ids)
      : Promise.resolve({ count: 0 }),
    ids.length > 0
      ? supabase
          .from('session')
          .select('date')
          .in('entrainement_id', ids)
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Parcours assigné (élève ou admin) : nouvel accueil ; null = accueil actuel
    chargerParcoursEleve(supabase, user.id).catch((e: Error) => {
      console.error('[accueil] parcours', e.message)
      return null
    }),
  ])
  const progression = parcoursAccueil ? calculerProgression(parcoursAccueil.etapes, parcoursAccueil.exercices, parcoursAccueil.etapeDepartId) : null
  // J-n de l'objectif (J+n une fois la date passée, J-0 le jour même) ; seulement avec une date.
  const jours = parcoursAccueil?.dateObjectif ? joursRestants(parcoursAccueil.dateObjectif) : null
  const compteARebours = jours === null ? null : jours >= 0 ? `J-${jours}` : `J+${-jours}`
  let prochaineAction: EtatProchaineAction = { type: 'aucune' }
  if (parcoursAccueil && progression) {
    // Règles dans lib/parcours/accompagnement.ts : REPRENDRE, Parcours
    // terminé, problème chaotique quand une feuille a son tour, sinon le parcours.
    const action = choisirProchaineAction({
      etapes: parcoursAccueil.etapes,
      progression,
      chaotiques: parcoursAccueil.chaotiques,
      exercices: parcoursAccueil.exercices,
      faitsDates: parcoursAccueil.faitsDates,
      assigneLe: parcoursAccueil.assigneLe,
      activiteEnCours: parcoursAccueil.activiteEnCours,
    })
    if (action?.type === 'en_cours') prochaineAction = { type: 'en_cours' }
    else if (action?.type === 'termine') prochaineAction = { type: 'termine' }
    else if (action?.type === 'commencer' && action.source === 'chaotique') {
      const feuille = parcoursAccueil.chaotiques.find((c) => c.id === action.accompagnementId)
      prochaineAction = { type: 'chaotique', feuilleId: action.feuilleId, titre: feuille?.titre ?? 'Feuille', exo: action.exo }
    } else if (action?.type === 'commencer') {
      const etapeCourante =
        progression.etapeCouranteIndex !== null ? parcoursAccueil.etapes[progression.etapeCouranteIndex] : null
      prochaineAction = {
        type: 'commencer',
        feuilleId: action.feuilleId,
        titre: etapeCourante?.titre ?? 'Feuille',
        exo: action.exo,
        examen: etapeCourante?.type === 'examen',
        libelle: etapeCourante?.libelle ?? null,
      }
    }
  }

  const uniqueDates = Array.from(
    new Set((sessionDates ?? []).map((s: { date: string }) => s.date))
  ).sort().reverse()

  let streak = 0
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  let current: string | null =
    uniqueDates[0] === today || uniqueDates[0] === yesterday
      ? uniqueDates[0]
      : null

  if (current) {
    for (const date of uniqueDates) {
      if (date === current) {
        streak++
        const prev: string = new Date(new Date(current).getTime() - 86400000)
          .toISOString().split('T')[0]
        current = prev
      } else break
    }
  }

  return (
    <AvecBarreOnglets profil={{ role: profile?.role ?? null, confidentiel: profile?.confidentiel ?? null }}>
      {/* Avec parcours : colonne de toute la hauteur au-dessus de la barre
          d'onglets, blocs à leur taille naturelle, PixelGrid dans le reste,
          16 px entre les blocs ; ne défile que si l'écran est trop petit. */}
      <div
        className={
          parcoursAccueil && progression
            ? 'flex min-h-[calc(100dvh-56px-env(safe-area-inset-bottom))] flex-col items-center gap-4 bg-bg px-4 py-4'
            : 'min-h-screen bg-bg flex flex-col items-center px-4 py-8 space-y-8'
        }
      >
        <div className="w-full max-w-sm flex items-center justify-between">
          <MenuProfil pseudo={pseudo} avatarUrl={avatarUrl} isAdmin={isAdmin} />
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <svg xmlns="http://www.w3.org/2000/svg"
                width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </Link>
            <Link href="/agora">
              <svg xmlns="http://www.w3.org/2000/svg"
                width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
                <path d="M6 3h12" />
                <path d="M6 21h12" />
                <path d="M6 3c0 5 4 7 6 9-2 2-6 4-6 9" />
                <path d="M18 3c0 5-4 7-6 9 2 2 6 4 6 9" />
              </svg>
            </Link>
            <LogoutButton />
          </div>
        </div>
        {parcoursAccueil && progression ? (
          <>
            <AccueilParcours
              parcours={parcoursAccueil}
              progression={progression}
              pixels={count ?? 0}
              streak={streak}
              compteARebours={compteARebours}
            />
            <ProchaineAction etat={prochaineAction} />
          </>
        ) : (
          <>
            <StreakBadge streak={streak} pixels={count ?? 0} />
            <div className="w-full max-w-sm rounded-2xl p-4">
              <PixelGrid count={count ?? 0} />
            </div>
            <div className="w-full max-w-sm">
              <Link href="/entrainement" className="block w-full rounded-2xl py-5 text-center font-bold text-lg bg-accent text-bg hover:opacity-90 transition-opacity">
                Entraînement
              </Link>
            </div>
          </>
        )}
      </div>
    </AvecBarreOnglets>
  )
}
