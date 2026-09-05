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
    .select('pseudo, nom, prenom, avatar_url, telephone, date_naissance, ville, plan, role')
    .eq('id', user.id)
    .single()

  const showAccessBanner =
    profile?.plan === 'gratuit' && profile?.role !== 'admin'

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
          ← Monstro
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Profil</h1>

        {showAccessBanner && (
          <div className="bg-surface-2 rounded-xl px-5 py-4 border-l-[3px] border-accent">
            <p className="font-bold text-text-primary text-sm m-0">
              Accès limité
            </p>
            <p className="text-text-secondary text-[13px] mt-1.5 mb-0">
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
          dateNaissance={profile?.date_naissance ?? ''}
          ville={profile?.ville ?? ''}
        />
        <Suspense fallback={null}>
          <AbonnementCard />
        </Suspense>
      </div>
    </div>
  )
}
