import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import AdminClient, { type Noeud } from './AdminClient'

export default async function AdminPage() {
  await requireAdmin()

  const supabase = createClient()

  const { data } = await supabase
    .from('noeud')
    .select('id, parent_id, nom, ordre')
    .order('ordre')

  const noeuds = (data ?? []) as Noeud[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Retour
          </Link>
          <Link href="/admin/corrections" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            Corrections →
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>

        <AdminClient noeuds={noeuds} />
      </div>
    </div>
  )
}
