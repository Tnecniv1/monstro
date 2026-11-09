import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { etapeOnboarding, premiereAssignation } from '@/lib/onboarding'
import { rattacherQuestionsParSet } from '@/lib/parcours/positionnement'
import type { ForumScriptEtape } from '../forum/types'
import OnboardingClient, { type DonneesOnboarding, type EtapeBienvenue, type QuestionBienvenue } from './OnboardingClient'

export const metadata: Metadata = { title: 'Bienvenue · Monstro' }
export const dynamic = 'force-dynamic'

type LigneEtape = {
  id: string
  ordre: number
  type: 'feuille' | 'examen'
  feuille_id: string | null
  qcm_set_id: string | null
  libelle: string | null
  feuille: { titre: string } | null
}

// Ligne de qcm_positionnement (questions rangées en sets).
type LigneQuestion = {
  id: string
  set_id: string
  ordre: number
  actif: boolean
  enonce: string
  choix: { id: string; texte: string }[] | null
  reponses_correctes: string[] | null
  image_url: string | null
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
      .select('id, ordre, type, feuille_id, qcm_set_id, libelle, feuille:feuille_entrainement ( titre )')
      .eq('parcours_id', parcoursId!)
      .order('ordre')
    if (errEtapes) {
      console.error('[bienvenue] parcours_etape', errEtapes)
      return { etape: 'positionnement', erreur: 'Impossible de charger ton parcours.' }
    }
    const lignes = (lignesEtapes ?? []) as unknown as LigneEtape[]
    const etapes: EtapeBienvenue[] = lignes.map((e) => ({
      id: e.id,
      ordre: e.ordre,
      type: e.type,
      titre: (e.type === 'examen' ? e.libelle : e.feuille?.titre) ?? e.feuille?.titre ?? e.libelle ?? 'Étape',
    }))

    // Questions actives des sets choisis par les étapes (qcm_positionnement),
    // rattachées à leurs étapes par rattacherQuestionsParSet.
    let questions: QuestionBienvenue[] = []
    const setIds = Array.from(new Set(lignes.filter((e) => e.type === 'feuille' && e.qcm_set_id).map((e) => e.qcm_set_id!)))
    if (setIds.length > 0) {
      const { data: lignesQuestions, error: errQuestions } = await supabase
        .from('qcm_positionnement')
        .select('id, set_id, ordre, actif, enonce, choix, reponses_correctes, image_url')
        .in('set_id', setIds)
        .eq('actif', true)
        .order('ordre')
      if (errQuestions) {
        console.error('[bienvenue] qcm_positionnement', errQuestions)
        return { etape: 'positionnement', erreur: 'Impossible de charger le test.' }
      }
      questions = rattacherQuestionsParSet(lignes, (lignesQuestions ?? []) as unknown as LigneQuestion[]).map((q) => ({
        id: q.id,
        question_id: q.question_id,
        etape_id: q.etape_id,
        ordre: q.ordre,
        reponses_correctes: q.reponses_correctes,
        enonce: q.enonce,
        choix: q.choix ?? [],
        image_url: q.image_url,
      }))
    }
    return { etape: 'positionnement', parcoursId: parcoursId!, etapes, questions }
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
