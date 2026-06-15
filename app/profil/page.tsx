import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfilClient from './ProfilClient'
import RapportCard from './RapportCard'
import { getUserStats } from '@/lib/stats/getUserStats'

export default async function ProfilPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, stats] = await Promise.all([
    supabase
      .from('user_profile')
      .select('pseudo, nom, prenom, avatar_url, telephone')
      .eq('id', user.id)
      .single(),
    getUserStats(user.id),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Monstro
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
        <RapportCard {...stats} />
        <ProfilClient
          userId={user.id}
          email={user.email ?? ''}
          pseudo={profile?.pseudo ?? ''}
          nom={profile?.nom ?? ''}
          prenom={profile?.prenom ?? ''}
          avatarUrl={profile?.avatar_url ?? null}
          telephone={profile?.telephone ?? ''}
        />
      </div>
    </div>
  )
}
