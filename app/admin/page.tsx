import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import AdminShell from './AdminShell'
import type { Noeud } from './AdminClient'
import type { FeuilleRow } from './corrections/CorrectionsClient'

export default async function AdminPage() {
  await requireAdmin()

  const supabase = createClient()

  const [{ data: noeudData }, { data: feuilleData }] = await Promise.all([
    supabase.from('noeud').select('id, parent_id, nom, ordre').order('ordre'),
    supabase
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
      .order('ordre'),
  ])

  const noeuds = (noeudData ?? []) as Noeud[]
  const feuilles = (feuilleData ?? []) as unknown as FeuilleRow[]

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE' }}>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <AdminShell noeuds={noeuds} feuilles={feuilles} />
      </div>
    </div>
  )
}
