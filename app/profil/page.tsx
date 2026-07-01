import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfilClient from './ProfilClient'
import AbonnementCard from './AbonnementCard'

export default async function ProfilPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profile')
    .select('pseudo, nom, prenom, avatar_url, telephone, plan, role')
    .eq('id', user.id)
    .single()

  const showAccessBanner =
    profile?.plan === 'gratuit' && profile?.role !== 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Monstro
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Profil</h1>

        {showAccessBanner && (
          <div
            style={{
              background: '#EDEAE3',
              borderRadius: 12,
              padding: '16px 20px',
              borderLeft: '3px solid #a78bfa',
            }}
          >
            <p style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 14, margin: 0 }}>
              Accès limité
            </p>
            <p style={{ color: '#57534e', fontSize: 13, margin: '6px 0 0' }}>
              Ton compte n&apos;a pas encore accès à l&apos;application. Abonne-toi
              ci-dessous pour débloquer l&apos;accès complet.
            </p>
          </div>
        )}

        <ProfilClient
          userId={user.id}
          email={user.email ?? ''}
          pseudo={profile?.pseudo ?? ''}
          nom={profile?.nom ?? ''}
          prenom={profile?.prenom ?? ''}
          avatarUrl={profile?.avatar_url ?? null}
          telephone={profile?.telephone ?? ''}
        />
        <Suspense fallback={null}>
          <AbonnementCard />
        </Suspense>
      </div>
    </div>
  )
}
