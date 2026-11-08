import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { etapeOnboarding, premiereAssignation } from '@/lib/onboarding'
import type { ForumScriptEtape } from '../forum/types'
import OnboardingClient, { type DonneesOnboarding, type EtapeBienvenue, type QuestionBienvenue } from './OnboardingClient'

export const metadata: Metadata = { title: 'Bienvenue · Monstro' }
export const dynamic = 'force-dynamic'

type LigneEtape = {
  id: string
  ordre: number
  type: 'feuille' | 'examen'
  libelle: string | null
  feuille: { titre: string } | null
}

type LigneQuestion = {
  id: string
  etape_id: string
  ordre: number
  question: {
    id: string
    enonce: string
    choix: { id: string; texte: string }[] | null
    reponses_correctes: string[] | null
    image_url: string | null
  } | null
}

// Onboarding en 3 étapes (règles dans lib/onboarding.ts). Le middleware y
// envoie l'élève tant qu'il n'a pas fini ; la page recalcule l'étape et ne
// charge que ce dont elle a besoin. Une erreur de lecture affiche un message
// et « Réessayer », jamais un écran blanc.
export default async function BienvenuePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile, error: errProfil } = await supabase
    .from('user_profile')
    .select('role, plan, script1_ouvert_at, parcours_eleve ( parcours_id, positionnement_at )')
    .eq('id', user.id)
    .single()
  if (errProfil || !profile) {
    console.error('[bienvenue] profil', errProfil)
    return <OnboardingClient userId={user.id} donnees={{ etape: null, erreur: 'Impossible de charger ton profil.' }} />
  }

  const assignation = premiereAssignation(
    profile.parcours_eleve as { parcours_id: string; positionnement_at: string | null } | { parcours_id: string; positionnement_at: string | null }[] | null
  )
  const etape = etapeOnboarding({
    role: profile.role,
    plan: profile.plan,
    script1OuvertAt: profile.script1_ouvert_at,
    assignation,
  })
  if (!etape) redirect('/')

  return <OnboardingClient key={etape} userId={user.id} donnees={await charger(supabase, etape, assignation?.parcours_id ?? null)} />
}

async function charger(
  supabase: ReturnType<typeof createClient>,
  etape: 'objectif' | 'positionnement' | 'introduction',
  parcoursId: string | null
): Promise<DonneesOnboarding> {
  if (etape === 'objectif') {
    const { data, error } = await supabase
      .from('parcours')
      .select('id, nom, description')
      .eq('actif', true)
      .order('ordre')
      .order('created_at')
    if (error) {
      console.error('[bienvenue] parcours', error)
      return { etape: 'objectif', erreur: 'Impossible de charger les objectifs.' }
    }
    return { etape: 'objectif', parcours: data ?? [] }
  }

  if (etape === 'positionnement') {
    const { data: lignesEtapes, error: errEtapes } = await supabase
      .from('parcours_etape')
      .select('id, ordre, type, libelle, feuille:feuille_entrainement ( titre )')
      .eq('parcours_id', parcoursId!)
      .order('ordre')
    if (errEtapes) {
      console.error('[bienvenue] parcours_etape', errEtapes)
      return { etape: 'positionnement', erreur: 'Impossible de charger ton parcours.' }
    }
    const etapes: EtapeBienvenue[] = ((lignesEtapes ?? []) as unknown as LigneEtape[]).map((e) => ({
      id: e.id,
      ordre: e.ordre,
      type: e.type,
      titre: (e.type === 'examen' ? e.libelle : e.feuille?.titre) ?? e.feuille?.titre ?? e.libelle ?? 'Étape',
    }))

    let questions: QuestionBienvenue[] = []
    if (etapes.length > 0) {
      const { data: lignesQuestions, error: errQuestions } = await supabase
        .from('parcours_positionnement')
        .select('id, etape_id, ordre, question:qcm_question ( id, enonce, choix, reponses_correctes, image_url )')
        .in(
          'etape_id',
          etapes.map((e) => e.id)
        )
        .order('ordre')
      if (errQuestions) {
        console.error('[bienvenue] parcours_positionnement', errQuestions)
        return { etape: 'positionnement', erreur: 'Impossible de charger le test.' }
      }
      questions = ((lignesQuestions ?? []) as unknown as LigneQuestion[])
        .filter((l) => l.question)
        .map((l) => ({
          id: l.id,
          etape_id: l.etape_id,
          ordre: l.ordre,
          reponses_correctes: l.question!.reponses_correctes,
          enonce: l.question!.enonce,
          choix: l.question!.choix ?? [],
          image_url: l.question!.image_url,
        }))
    }
    return { etape: 'positionnement', etapes, questions }
  }

  const { data: script, error } = await supabase
    .from('forum_scripts')
    .select('titre, citation, etapes')
    .eq('ordre', 1)
    .maybeSingle()
  if (error) {
    console.error('[bienvenue] forum_scripts', error)
    return { etape: 'introduction', erreur: 'Impossible de charger l’introduction.' }
  }
  return {
    etape: 'introduction',
    script: script
      ? {
          titre: script.titre as string,
          citation: (script.citation as string | null) ?? null,
          etapes: (Array.isArray(script.etapes) ? script.etapes : []) as ForumScriptEtape[],
        }
      : null,
  }
}
