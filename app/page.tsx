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
    <div className="min-h-dvh bg-stone-100 flex flex-col">
      {/* Navbar */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/profil" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
              className="rounded-full bg-stone-200 flex items-center justify-center font-semibold text-gray-600 text-xs"
              style={{ width: 32, height: 32 }}
            >
              {pseudo ? pseudo[0].toUpperCase() : '?'}
            </div>
          )}
          <span className="font-semibold text-gray-900">{pseudo}</span>
        </Link>

        <div className="flex items-center">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </Link>
          {isAdmin && (
            <Link href="/admin" className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Streak + barre de progression */}
      <div className="w-full max-w-sm mx-auto px-4 pb-2">
        <StreakBadge streak={streak} />
      </div>

      {/* PixelGrid — occupe l'espace restant, centrée */}
      <div className="flex-1 flex flex-col items-center justify-center py-2">
        <PixelGrid count={count ?? 0} />
      </div>

      {/* Boutons de navigation */}
      <div className="w-full max-w-sm mx-auto flex flex-col gap-[7px] sm:gap-3 px-4 pb-8 pt-2">
        <Link href="/entrainement" className="block w-full rounded-2xl py-[11px] sm:py-5 text-center font-bold text-base sm:text-lg bg-stone-200 text-gray-900 active:bg-stone-300 transition-colors">
          Entraînement
        </Link>
        <Link href="/parcours" className="block w-full rounded-2xl py-[11px] sm:py-5 text-center font-bold text-base sm:text-lg bg-stone-200 text-gray-900 active:bg-stone-300 transition-colors">
          Parcours
        </Link>
        <Link href="/classement" className="block w-full rounded-2xl py-[11px] sm:py-5 text-center font-bold text-base sm:text-lg bg-stone-200 text-gray-900 active:bg-stone-300 transition-colors">
          Classement
        </Link>
        <Link href="/bibliotheque" className="block w-full rounded-2xl py-[11px] sm:py-5 text-center font-bold text-base sm:text-lg bg-stone-200 text-gray-900 active:bg-stone-300 transition-colors">
          Bibliothèque
        </Link>
      </div>
    </div>
  )
}
