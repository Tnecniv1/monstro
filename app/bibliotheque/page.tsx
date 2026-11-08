import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Feuille } from './BibliothequeClient'
import BibliothequeVues from './BibliothequeVues'
import { estCategorieCours, type Cours } from './cours'

export default async function BibliothequePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ?vue=cours (absent = problèmes) et, en vue Cours, ?categorie=introduction|exploration.
  const vueParam = Array.isArray(searchParams.vue) ? searchParams.vue[0] : searchParams.vue
  const categorieParam = Array.isArray(searchParams.categorie) ? searchParams.categorie[0] : searchParams.categorie

  const [{ data }, { data: focusData }, { data: terminesData }, { data: coursData }] = await Promise.all([
    supabase
      .from('feuille_entrainement')
      .select(`
        id, titre, volume, pdf_url,
        noeud:noeud_id (
          id, nom, ordre, parent_id,
          parent:parent_id (
            id, nom, ordre, parent_id,
            grandparent:parent_id ( id, nom, ordre )
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
    // Cours (vue « Cours ») — anciennes ressources du Forum.
    supabase
      .from('forum_resources')
      .select('id, titre, description, pdf_url, categorie')
      .order('ordre'),
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
  const cours = (coursData ?? []) as Cours[]

  // Ancien onboarding (étape Focus) désactivé : remplacé par /bienvenue.
  // Le bandeau Focus de BibliothequeVues ne s'affiche donc plus.
  const etapeFocus = null
  const initialVue = vueParam === 'cours' && !etapeFocus ? 'cours' : 'problemes'
  const initialCategorie = initialVue === 'cours' && estCategorieCours(categorieParam) ? categorieParam : null

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-text-primary">Bibliothèque</h1>

        <BibliothequeVues
          initialVue={initialVue}
          initialCategorie={initialCategorie}
          cours={cours}
          problemes={{
            feuilles,
            focusIds,
            termineIds,
            userId: user.id,
            etapeFocus,
          }}
        />
      </div>
    </div>
  )
}
