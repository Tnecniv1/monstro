export const revalidate = 0

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './DashboardShell'
import type { EnrichedProfile } from './types'

export default async function DashboardPage() {
  const { user, profile } = await getUser()
  if (!user) redirect('/login')

  const isAdmin = profile?.role === 'admin'
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: profiles }, { data: sessionsToday }, { data: entrainementsToday }] =
    await Promise.all([
      supabase
        .from('user_profile')
        .select('id, pseudo, avatar_url, prenom, nom')
        .order('pseudo'),
      supabase
        .from('session')
        .select('date, temps_min, entrainement!inner(user_id)')
        .eq('date', today),
      supabase
        .from('entrainement')
        .select('id, user_id')
        .gte('date_creation', today + 'T00:00:00+00'),
    ])

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  type SessionRow = { date: string; temps_min: number; entrainement: { user_id: string } }
  type EntrainementRow = { id: string; user_id: string }

  const tempsParUser: Record<string, number> = {}
  for (const s of (sessionsToday ?? []) as unknown as SessionRow[]) {
    const uid = s.entrainement.user_id
    if (uid) tempsParUser[uid] = (tempsParUser[uid] ?? 0) + (s.temps_min ?? 0)
  }

  const enriched: EnrichedProfile[] = (profiles ?? []).map((p) => {
    const actif =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessionsToday?.some((s: any) => s.entrainement.user_id === p.id) ||
      (entrainementsToday as EntrainementRow[] | null)?.some((e) => e.user_id === p.id) ||
      false
    return { ...p, actif, tempsTotal: tempsParUser[p.id] ?? 0 }
  })

  enriched.sort((a, b) => Number(b.actif) - Number(a.actif))
  const activeCount = enriched.filter((p) => p.actif).length

  return (
    <DashboardShell
      enriched={enriched}
      dateLabel={dateLabel}
      activeCount={activeCount}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  )
}
