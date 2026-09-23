import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import RapportCard from '@/app/profil/RapportCard'
import { getUserStats } from '@/lib/stats/getUserStats'

interface Props {
  params: { userId: string }
}

export default async function EleveProfilPage({ params }: Props) {
  await requireAdmin()

  const { userId } = params
  const supabase = createClient()

  const [{ data: profile }, stats] = await Promise.all([
    supabase
      .from('user_profile')
      .select('pseudo, nom, prenom, avatar_url, telephone')
      .eq('id', userId)
      .single(),
    getUserStats(userId),
  ])

  if (!profile) notFound()

  const fullName = `${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim()
  const pseudo = profile.pseudo ?? (fullName || '—')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Dashboard
          </Link>
        </div>

        {/* En-tête élève */}
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={pseudo}
              width={56}
              height={56}
              className="rounded-full object-cover flex-shrink-0"
              style={{ width: 56, height: 56 }}
            />
          ) : (
            <div
              className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 flex-shrink-0"
              style={{ width: 56, height: 56, fontSize: 22 }}
            >
              {pseudo[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{pseudo}</h1>
            {(profile.prenom || profile.nom) && profile.pseudo && (
              <p className="text-sm text-gray-500">{`${profile.prenom ?? ''} ${profile.nom ?? ''}`.trim()}</p>
            )}
            {profile.telephone && (
              <p className="text-sm text-gray-400">{profile.telephone}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <RapportCard {...stats} />
      </div>
    </div>
  )
}
