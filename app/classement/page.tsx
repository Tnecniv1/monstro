import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClassementClient from './ClassementClient'

export default async function ClassementPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profiles } = await supabase
    .from('user_profile')
    .select('id, pseudo')

  const { data: observations } = await supabase
    .from('observation')
    .select('etat, entrainement!inner(user_id)')

  type Profile = { id: string; pseudo: string | null }
  type ObsRow = { etat: string; entrainement: { user_id: string } }

  const scores = (profiles ?? [] as Profile[]).map((profile) => {
    const userObs = (observations ?? [] as ObsRow[]).filter(
      (o) => (o.entrainement as { user_id: string }).user_id === profile.id
    )
    const score = userObs.reduce((acc, o) => {
      if (o.etat === 'succes') return acc + 1
      if (o.etat === 'echec') return acc - 1
      return acc
    }, 0)
    return { id: profile.id, pseudo: profile.pseudo ?? '—', score }
  })

  scores.sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Classement</h1>
        <ClassementClient classement={scores} userId={user.id} />
      </div>
    </div>
  )
}
