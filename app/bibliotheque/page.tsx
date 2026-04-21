import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BibliothequeClient, { type Feuille } from './BibliothequeClient'

export default async function BibliothequePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('feuille_entrainement')
    .select(`
      id, titre, volume,
      noeud:noeud_id (
        id, nom, parent_id,
        parent:parent_id (
          id, nom, parent_id,
          grandparent:parent_id ( id, nom )
        )
      )
    `)
    .order('ordre')

  const feuilles = (data ?? []) as unknown as Feuille[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <h1 className="text-2xl font-bold text-gray-900">Bibliothèque</h1>

        <BibliothequeClient feuilles={feuilles} />
      </div>
    </div>
  )
}
