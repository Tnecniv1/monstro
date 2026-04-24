export const revalidate = 0

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'

function formatTemps(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export default async function DashboardPage() {
  const { user } = await getUser()
  if (!user) redirect('/login')

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

  type SessionRow = {
    date: string
    temps_min: number
    entrainement: { user_id: string }
  }

  type EntrainementRow = {
    id: string
    user_id: string
    ref_exo: number
    statut: string
    feuille_entrainement: { titre: string } | null
  }

  const tempsParUser: Record<string, number> = {}
  for (const s of (sessionsToday ?? []) as unknown as SessionRow[]) {
    const uid = s.entrainement.user_id
    if (uid) {
      tempsParUser[uid] = (tempsParUser[uid] ?? 0) + (s.temps_min ?? 0)
    }
  }

  const enriched = (profiles ?? []).map((profile) => {
    const actif =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessionsToday?.some((s: any) => s.entrainement.user_id === profile.id) ||
      (entrainementsToday as EntrainementRow[] | null)?.some((e) => e.user_id === profile.id) ||
      false
    const tempsTotal = tempsParUser[profile.id] ?? 0
    return { ...profile, actif, tempsTotal }
  })

  enriched.sort((a, b) => Number(b.actif) - Number(a.actif))

  const activeCount = enriched.filter((p) => p.actif).length

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Retour
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            <span className={activeCount > 0 ? 'text-green-600' : 'text-red-500'}>
              {activeCount}
            </span>
            <span className="text-gray-400"> / {enriched.length} actifs aujourd&apos;hui</span>
          </h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{dateLabel}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {enriched.map(({ id, pseudo, prenom, nom, avatar_url, actif, tempsTotal }) => {
            const label = pseudo ?? `${prenom} ${nom}`

            if (actif) {
              return (
                <div key={id} className="relative bg-white rounded-xl border-2 border-gray-900 shadow-sm p-4">
                  {tempsTotal > 0 && (
                    <span className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-medium rounded-full px-2 py-0.5">
                      {formatTemps(tempsTotal)}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {avatar_url ? (
                      <img
                        src={avatar_url}
                        alt={label}
                        width={28}
                        height={28}
                        className="rounded-full object-cover flex-shrink-0"
                        style={{ width: 28, height: 28 }}
                      />
                    ) : (
                      <div
                        className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs flex-shrink-0"
                        style={{ width: 28, height: 28 }}
                      >
                        {label ? label[0].toUpperCase() : '?'}
                      </div>
                    )}
                    <span className="font-medium text-gray-900 text-sm truncate">{label}</span>
                  </div>
                </div>
              )
            }

            return (
              <div key={id} className="bg-white rounded-xl border border-gray-200 p-4 opacity-50">
                <div className="flex items-center gap-2">
                  {avatar_url ? (
                    <img
                      src={avatar_url}
                      alt={label}
                      width={28}
                      height={28}
                      className="rounded-full object-cover flex-shrink-0"
                      style={{ width: 28, height: 28 }}
                    />
                  ) : (
                    <div
                      className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs flex-shrink-0"
                      style={{ width: 28, height: 28 }}
                    >
                      {label ? label[0].toUpperCase() : '?'}
                    </div>
                  )}
                  <span className="font-medium text-gray-900 text-sm truncate">{label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
