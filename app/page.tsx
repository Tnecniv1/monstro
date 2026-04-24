import Link from 'next/link'
import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'
import PixelGrid from './components/PixelGrid'
import StreakBadge from './components/StreakBadge'
import LogoutButton from './components/LogoutButton'

export default async function HomePage() {
  const { user, profile } = await getUser()
  const pseudo = profile?.pseudo ?? user.email ?? ''
  const isAdmin = profile?.role === 'admin'
  const avatarUrl = profile?.avatar_url ?? null
  const supabase = createClient()

  const { data: entIds } = await supabase
    .from('entrainement')
    .select('id')
    .eq('user_id', user.id)

  const ids = entIds?.map((e) => e.id) ?? []

  const [{ count }, { data: sessionDates }] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('observation')
          .select('id', { count: 'exact', head: true })
          .eq('etat', 'succes')
          .in('entrainement_id', ids)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('session')
      .select('date, entrainement!inner(user_id)')
      .filter('entrainement.user_id', 'eq', user.id)
      .order('date', { ascending: false }),
  ])

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8 space-y-8">
      <div className="w-full max-w-sm flex items-center justify-between">
        <Link href="/profil" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={pseudo}
              width={28}
              height={28}
              className="rounded-full object-cover"
              style={{ width: 28, height: 28 }}
            />
          ) : (
            <div
              className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs"
              style={{ width: 28, height: 28 }}
            >
              {pseudo ? pseudo[0].toUpperCase() : '?'}
            </div>
          )}
          <span className="font-semibold text-gray-900">{pseudo}</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <svg xmlns="http://www.w3.org/2000/svg"
              width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-700">
              Admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <StreakBadge streak={streak} />
      <PixelGrid count={count ?? 0} />

      <div className="w-full max-w-sm space-y-3">
        <Link href="/entrainement" className="block w-full rounded-2xl py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors">
          Entraînement
        </Link>
        <Link href="/parcours" className="block w-full rounded-2xl py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors">
          Parcours
        </Link>
        <Link href="/classement" className="block w-full rounded-2xl py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors">
          Classement
        </Link>
        <Link href="/bibliotheque" className="block w-full rounded-2xl py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors">
          Bibliothèque
        </Link>
      </div>
    </div>
  )
}
