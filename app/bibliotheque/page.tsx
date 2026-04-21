import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BibliothequeClient, { type Feuille } from './BibliothequeClient'

export default async function BibliothequePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data }, { data: focusData }, { data: terminesData }] = await Promise.all([
    supabase
      .from('feuille_entrainement')
      .select(`
        id, titre, volume, pdf_url,
        noeud:noeud_id (
          id, nom, parent_id,
          parent:parent_id (
            id, nom, parent_id,
            grandparent:parent_id ( id, nom )
          )
        )
      `)
      .order('ordre'),
    supabase
      .from('feuille_focus')
      .select('feuille_id')
      .eq('user_id', user.id),
    supabase
      .from('entrainement')
      .select('feuille_id, feuille_entrainement!inner(volume)')
      .eq('user_id', user.id)
      .eq('statut', 'termine'),
  ])

  const focusIds = new Set(focusData?.map((f) => f.feuille_id) ?? [])

  type TermineRow = { feuille_id: string; feuille_entrainement: { volume: number } }
  const countByFeuille: Record<string, number> = {}
  for (const e of terminesData ?? []) {
    countByFeuille[e.feuille_id] = (countByFeuille[e.feuille_id] ?? 0) + 1
  }
  const termineIds = new Set(
    ((terminesData ?? []) as unknown as TermineRow[])
      .filter((e) => countByFeuille[e.feuille_id] >= e.feuille_entrainement.volume)
      .map((e) => e.feuille_id)
  )

  const feuilles = (data ?? []) as unknown as Feuille[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-gray-900">Bibliothèque</h1>

        <BibliothequeClient
          feuilles={feuilles}
          focusIds={focusIds}
          termineIds={termineIds}
          userId={user.id}
        />
      </div>
    </div>
  )
}
