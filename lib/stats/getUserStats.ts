import { createClient } from '@/lib/supabase/server'
import type { RapportCardProps } from '@/app/profil/RapportCard'

export type UserStats = Omit<RapportCardProps, 'note'>

export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = createClient()

  const { data: ents } = await supabase
    .from('entrainement')
    .select('id, feuille_id, statut, date_creation')
    .eq('user_id', userId)

  const entIds = ents?.map((e) => e.id) ?? []

  const [sessionsRes, obsRes, corrsRes, feuillesRes] = await Promise.all([
    entIds.length > 0
      ? supabase.from('session').select('temps_min, date').in('entrainement_id', entIds)
      : { data: [] as { temps_min: number; date: string }[] | null },
    entIds.length > 0
      ? supabase.from('observation').select('etat, entrainement_id').in('entrainement_id', entIds)
      : { data: [] as { etat: string; entrainement_id: string }[] | null },
    entIds.length > 0
      ? supabase
          .from('correction_tentative')
          .select('entrainement_id')
          .eq('statut', 'succes')
          .in('entrainement_id', entIds)
      : { data: [] as { entrainement_id: string }[] | null },
    supabase.from('feuille_entrainement').select('id'),
  ])

  const sessions = sessionsRes.data ?? []
  const obs = obsRes.data ?? []
  const corrs = corrsRes.data ?? []
  const totalFeuilles = feuillesRes.data?.length ?? 0

  // Mois courant et mois précédent (pour les deltas)
  const now = new Date()
  const firstDayCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const firstDayPrev = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}-01`

  const minutesConcentration = sessions
    .filter((s) => s.date >= firstDayCurrent)
    .reduce((sum, s) => sum + s.temps_min, 0)

  const minutesConcentrationPrev = sessions
    .filter((s) => s.date >= firstDayPrev && s.date < firstDayCurrent)
    .reduce((sum, s) => sum + s.temps_min, 0)

  // Problèmes réussis (total)
  const problemesReussis = obs.filter(
    (o) => o.etat === 'succes' || o.etat === 'corrige',
  ).length

  // Score total
  const obsScore = obs.reduce((acc, o) => {
    if (o.etat === 'succes' || o.etat === 'corrige') return acc + 1
    if (o.etat === 'echec') return acc - 1
    return acc
  }, 0)
  const corrBonus = new Set(corrs.map((c) => c.entrainement_id)).size * 2
  const scoreTotal = obsScore + corrBonus

  // Score variation = score sur les entrainements du mois courant
  const entsThisMonth = new Set(
    (ents ?? [])
      .filter((e) => e.date_creation.slice(0, 10) >= firstDayCurrent)
      .map((e) => e.id),
  )
  const scoreVariation = obs
    .filter((o) => entsThisMonth.has(o.entrainement_id))
    .reduce((acc, o) => {
      if (o.etat === 'succes' || o.etat === 'corrige') return acc + 1
      if (o.etat === 'echec') return acc - 1
      return acc
    }, 0)

  // Feuilles
  const feuilleTerminees = new Set(
    (ents ?? [])
      .filter((e) => e.statut === 'termine' && e.feuille_id)
      .map((e) => e.feuille_id),
  )
  const feuilleEnCours = new Set(
    (ents ?? [])
      .filter(
        (e) =>
          e.statut === 'en_cours' &&
          e.feuille_id &&
          !feuilleTerminees.has(e.feuille_id),
      )
      .map((e) => e.feuille_id),
  )
  const feuillesFait = feuilleTerminees.size
  const feuillesEnCours = feuilleEnCours.size
  const feuillesNonFait = Math.max(0, totalFeuilles - feuillesFait - feuillesEnCours)

  return {
    problemesReussis,
    minutesConcentration,
    minutesConcentrationPrev,
    scoreTotal,
    scoreVariation,
    feuillesFait,
    feuillesEnCours,
    feuillesNonFait,
  }
}
