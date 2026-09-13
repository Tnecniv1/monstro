export const revalidate = 0

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './DashboardShell'
import type { WeekActivityProfile, WeekDay } from './types'

const JOURS_LABEL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Semaine calendaire en cours (lundi -> dimanche), pas une fenêtre glissante.
function getSemaineCourante(): WeekDay[] {
  const now = new Date()
  const jsDay = now.getDay() // 0=dim, 1=lun, ..., 6=sam
  const diffLundi = jsDay === 0 ? -6 : 1 - jsDay
  const lundi = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffLundi)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i)
    return {
      date: toDateStr(d),
      label: JOURS_LABEL[i],
      dateLabel: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    }
  })
}

export default async function DashboardPage() {
  const { user, profile } = await getUser()
  if (!user) redirect('/login')

  const isAdmin = profile?.role === 'admin'
  const supabase = createClient()

  const jours = getSemaineCourante()
  const lundiStr = jours[0].date
  const dimancheStr = jours[6].date

  const [{ data: profiles }, { data: sessionsSemaine }, { data: fakeData }] = await Promise.all([
    supabase
      .from('user_profile')
      .select('id, pseudo, avatar_url, prenom, nom')
      .order('pseudo'),
    supabase
      .from('session')
      .select('date, entrainement!inner(user_id)')
      .gte('date', lundiStr)
      .lte('date', dimancheStr),
    supabase.rpc('get_fake_user_ids'),
  ])

  const fakeUserIds = new Set(
    (fakeData ?? []).map((r: { user_id: string }) => r.user_id)
  )

  type SessionRow = { date: string; entrainement: { user_id: string } }

  // Jours (dates) où chaque utilisateur a au moins une session cette semaine.
  const datesActivesParUser: Record<string, Set<string>> = {}
  for (const s of (sessionsSemaine ?? []) as unknown as SessionRow[]) {
    const uid = s.entrainement?.user_id
    if (!uid) continue
    if (!datesActivesParUser[uid]) datesActivesParUser[uid] = new Set()
    datesActivesParUser[uid].add(s.date)
  }

  const matrice: WeekActivityProfile[] = (profiles ?? []).map((p) => {
    const datesActives = datesActivesParUser[p.id] ?? new Set<string>()
    const activite = jours.map((j) => datesActives.has(j.date))
    return {
      ...p,
      is_fake: fakeUserIds.has(p.id),
      activite,
      nbJoursActifs: activite.filter(Boolean).length,
    }
  })

  matrice.sort((a, b) => b.nbJoursActifs - a.nbJoursActifs)

  return (
    <DashboardShell matrice={matrice} jours={jours} isAdmin={isAdmin} />
  )
}
