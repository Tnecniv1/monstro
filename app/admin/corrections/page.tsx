import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import CorrectionsClient, { type FeuilleRow } from './CorrectionsClient'

export default async function CorrectionsPage() {
  await requireAdmin()
  const supabase = createClient()

  const { data } = await supabase
    .from('feuille_entrainement')
    .select(`
      id, titre, ordre,
      noeud:noeud_id (
        id, nom, parent_id,
        parent:parent_id (
          id, nom, parent_id,
          grandparent:parent_id ( id, nom )
        )
      ),
      correction ( id, pdf_url )
    `)
    .order('ordre')

  const feuilles = (data ?? []) as unknown as FeuilleRow[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← Admin
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Corrections</h1>

        <CorrectionsClient feuilles={feuilles} />

      </div>
    </div>
  )
}
