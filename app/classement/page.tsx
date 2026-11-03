import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClassementClient, { type LigneClassement } from './ClassementClient'

export default async function ClassementPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Semaine en cours (lundi-dimanche, heure de Paris). Éligibilité, pixels,
  // jours actifs, rang et départage des ex-aequo sont calculés en base.
  const { data, error } = await supabase.rpc('classement_semaine')

  if (error) throw new Error(`classement_semaine : ${error.message}`)

  const classement = (data ?? []) as LigneClassement[]

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-text-primary">Classement</h1>
        <ClassementClient classement={classement} userId={user.id} />
      </div>
    </div>
  )
}
