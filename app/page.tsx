import { getUser } from '@/lib/supabase/getUser'
import { createClient } from '@/lib/supabase/server'
import Header from './components/Header'
import PixelGrid from './components/PixelGrid'

export default async function HomePage() {
  const { user, profile } = await getUser()
  const supabase = createClient()

  const pseudo = profile?.pseudo ?? user.email ?? ''
  const isAdmin = profile?.role === 'admin'

  const { data: entIds } = await supabase
    .from('entrainement')
    .select('id')
    .eq('user_id', user.id)

  const ids = entIds?.map((e) => e.id) ?? []

  const { count } = ids.length > 0
    ? await supabase
        .from('observation')
        .select('id', { count: 'exact', head: true })
        .eq('etat', 'succes')
        .in('entrainement_id', ids)
    : { count: 0 }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <Header pseudo={pseudo} isAdmin={isAdmin} />

        {/* Pixel Grid */}
        <PixelGrid count={count ?? 0} />

      </div>
    </div>
  )
}
