import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { RapportCardProps } from '@/app/profil/RapportCard'

export type UserStats = Omit<RapportCardProps, 'note'>

type Entrainement = { id: string; date_creation: string }
type Session = { temps_min: number; date: string }
type Observation = { etat: string; entrainement_id: string }

// Par défaut le client de la session courante ; le cron passe un client service role.
async function fetchRawData(userId: string, supabase: SupabaseClient = createClient()) {

  const { data: ents } = await supabase
    .from('entrainement')
    .select('id, date_creation')
    .eq('user_id', userId)

  const entIds = ents?.map((e) => e.id) ?? []

  const [sessionsRes, obsRes] = await Promise.all([
    entIds.length > 0
      ? supabase.from('session').select('temps_min, date').in('entrainement_id', entIds)
      : { data: [] as Session[] | null },
    entIds.length > 0
      ? supabase.from('observation').select('etat, entrainement_id').in('entrainement_id', entIds)
      : { data: [] as Observation[] | null },
  ])

  return {
    ents: (ents ?? []) as Entrainement[],
    sessions: (sessionsRes.data ?? []) as Session[],
    obs: (obsRes.data ?? []) as Observation[],
  }
}

/**
 * Calcule les stats sur [dateDebut, dateFin) pour la période courante et
 * [dateDebutPrev, dateFinPrev) pour la période de comparaison. Les bornes
 * sont des chaînes YYYY-MM-DD comparées lexicographiquement.
 */
function computeStats(
  ents: Entrainement[],
  sessions: Session[],
  obs: Observation[],
  dateDebut: string,
  dateFin: string,
  dateDebutPrev: string,
  dateFinPrev: string,
): UserStats {
  const minutesConcentration = sessions
    .filter((s) => s.date >= dateDebut && s.date < dateFin)
    .reduce((sum, s) => sum + s.temps_min, 0)

  const minutesConcentrationPrev = sessions
    .filter((s) => s.date >= dateDebutPrev && s.date < dateFinPrev)
    .reduce((sum, s) => sum + s.temps_min, 0)

  // Problèmes réussis (total, toutes périodes confondues — progression vers l'objectif)
  const problemesReussis = obs.filter(
    (o) => o.etat === 'succes' || o.etat === 'corrige',
  ).length

  const entsCourant = new Set(
    ents
      .filter((e) => {
        const d = e.date_creation.slice(0, 10)
        return d >= dateDebut && d < dateFin
      })
      .map((e) => e.id),
  )
  const entsPrecedent = new Set(
    ents
      .filter((e) => {
        const d = e.date_creation.slice(0, 10)
        return d >= dateDebutPrev && d < dateFinPrev
      })
      .map((e) => e.id),
  )

  const obsCourant = obs.filter((o) => entsCourant.has(o.entrainement_id))
  const obsPrecedent = obs.filter((o) => entsPrecedent.has(o.entrainement_id))

  const tauxReussiteFor = (list: Observation[]) => {
    if (list.length === 0) return 0
    const reussis = list.filter((o) => o.etat === 'succes' || o.etat === 'corrige').length
    return Math.round((reussis / list.length) * 100)
  }

  return {
    problemesTravailles: obsCourant.length,
    problemesTravaillesPrev: obsPrecedent.length,
    minutesConcentration,
    minutesConcentrationPrev,
    tauxReussite: tauxReussiteFor(obsCourant),
    tauxReussitePrev: tauxReussiteFor(obsPrecedent),
    problemesReussis,
  }
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Stats du mois courant (glissant, jusqu'à aujourd'hui) vs mois précédent. */
export async function getUserStats(userId: string): Promise<UserStats> {
  const { ents, sessions, obs } = await fetchRawData(userId)

  const now = new Date()
  const firstDayCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const prevM = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const firstDayPrev = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}-01`

  // Pas de borne haute pour le mois courant : il est toujours "en cours".
  return computeStats(ents, sessions, obs, firstDayCurrent, '9999-12-31', firstDayPrev, firstDayCurrent)
}

/** Stats de la semaine [lundi, lundi+7) vs la semaine précédente. */
export async function getUserStatsForWeek(
  userId: string,
  lundi: string,
  supabase?: SupabaseClient,
): Promise<UserStats> {
  const { ents, sessions, obs } = await fetchRawData(userId, supabase)

  const dateFin = addDays(lundi, 7)
  const dateDebutPrev = addDays(lundi, -7)

  return computeStats(ents, sessions, obs, lundi, dateFin, dateDebutPrev, lundi)
}
