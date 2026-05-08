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
    ids.length > 0
      ? supabase
          .from('session')
          .select('date')
          .in('entrainement_id', ids)
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] }),
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
    <div className="min-h-dvh bg-gray-50 flex flex-col px-4">
      {/* Top bar */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between py-4">
        <Link href="/profil" className="flex items-center gap-2 hover:opacity-80 transition-opacity -ml-1 px-1 py-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={pseudo}
              width={32}
              height={32}
              className="rounded-full object-cover"
              style={{ width: 32, height: 32 }}
            />
          ) : (
            <div
              className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs"
              style={{ width: 32, height: 32 }}
            >
              {pseudo ? pseudo[0].toUpperCase() : '?'}
            </div>
          )}
          <span className="font-semibold text-gray-900">{pseudo}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/dashboard" className="p-[10px] sm:p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="w-6 h-6 sm:w-[22px] sm:h-[22px] text-gray-400 hover:text-gray-700 transition-colors">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </Link>
          {isAdmin && (
            <Link href="/admin" aria-label="Admin" className="p-[10px] sm:p-2 rounded-lg text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 sm:w-5 sm:h-5">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              <span className="hidden sm:inline text-sm">Admin</span>
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Zone centrale — streak + grille, centrée verticalement */}
      <div className="flex-1 flex flex-col items-center justify-end sm:justify-center gap-5 pb-6 sm:py-2">
        <StreakBadge streak={streak} />
        <PixelGrid count={count ?? 0} />
      </div>

      {/* Boutons de navigation */}
      <div className="w-full max-w-sm mx-auto space-y-2 sm:space-y-3 pb-4 sm:pb-8 pt-3 sm:pt-4">
        <Link href="/entrainement" className="block w-full rounded-2xl py-3 sm:py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 active:bg-gray-300 transition-colors">
          Entraînement
        </Link>
        <Link href="/parcours" className="block w-full rounded-2xl py-3 sm:py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 active:bg-gray-300 transition-colors">
          Parcours
        </Link>
        <Link href="/classement" className="block w-full rounded-2xl py-3 sm:py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 active:bg-gray-300 transition-colors">
          Classement
        </Link>
        <Link href="/bibliotheque" className="block w-full rounded-2xl py-3 sm:py-5 text-center font-bold text-lg bg-gray-200 text-gray-900 active:bg-gray-300 transition-colors">
          Bibliothèque
        </Link>
      </div>
    </div>
  )
}
