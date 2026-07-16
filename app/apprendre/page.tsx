import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApprendreClient, { type Niveau } from './ApprendreClient'

export default async function ApprendrePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: niveauxData } = await supabase.from('qcm_niveau').select('niveau, nom').order('niveau')

  const niveaux = (niveauxData ?? []) as Niveau[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-gray-900">Apprendre</h1>

        <ApprendreClient userId={user.id} niveaux={niveaux} />
      </div>
    </div>
  )
}
