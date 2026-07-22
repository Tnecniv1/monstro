import { createClient } from '@/lib/supabase/server'
import type { RapportCardProps } from '@/app/profil/RapportCard'

export type UserStats = Omit<RapportCardProps, 'note'>

export async function getUserStats(userId: string): Promise<UserStats> {
  const supabase = createClient()

  const { data: ents } = await supabase
    .from('entrainement')
    .select('id, date_creation')
    .eq('user_id', userId)

  const entIds = ents?.map((e) => e.id) ?? []

  const [sessionsRes, obsRes] = await Promise.all([
    entIds.length > 0
      ? supabase.from('session').select('temps_min, date').in('entrainement_id', entIds)
      : { data: [] as { temps_min: number; date: string }[] | null },
    entIds.length > 0
      ? supabase.from('observation').select('etat, entrainement_id').in('entrainement_id', entIds)
      : { data: [] as { etat: string; entrainement_id: string }[] | null },
  ])

  const sessions = sessionsRes.data ?? []
  const obs = obsRes.data ?? []

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

  // Problèmes réussis (total, toutes périodes confondues — progression vers l'objectif)
  const problemesReussis = obs.filter(
    (o) => o.etat === 'succes' || o.etat === 'corrige',
  ).length

  // Entraînements du mois courant / précédent
  const entsThisMonth = new Set(
    (ents ?? [])
      .filter((e) => e.date_creation.slice(0, 10) >= firstDayCurrent)
      .map((e) => e.id),
  )
  const entsPrevMonth = new Set(
    (ents ?? [])
      .filter(
        (e) =>
          e.date_creation.slice(0, 10) >= firstDayPrev &&
          e.date_creation.slice(0, 10) < firstDayCurrent,
      )
      .map((e) => e.id),
  )

  const obsThisMonth = obs.filter((o) => entsThisMonth.has(o.entrainement_id))
  const obsPrevMonth = obs.filter((o) => entsPrevMonth.has(o.entrainement_id))

  // Problèmes travaillés = nombre de problèmes rencontrés dans le mois
  const problemesTravailles = obsThisMonth.length
  const problemesTravaillesPrev = obsPrevMonth.length

  // Taux de réussite = % de problèmes réussis parmi ceux travaillés dans le mois
  const tauxReussiteFor = (list: typeof obs) => {
    if (list.length === 0) return 0
    const reussis = list.filter((o) => o.etat === 'succes' || o.etat === 'corrige').length
    return Math.round((reussis / list.length) * 100)
  }
  const tauxReussite = tauxReussiteFor(obsThisMonth)
  const tauxReussitePrev = tauxReussiteFor(obsPrevMonth)

  return {
    problemesTravailles,
    problemesTravaillesPrev,
    minutesConcentration,
    minutesConcentrationPrev,
    tauxReussite,
    tauxReussitePrev,
    problemesReussis,
  }
}
