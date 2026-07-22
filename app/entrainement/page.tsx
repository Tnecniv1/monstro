import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EntrainementClient from './EntrainementClient'
import type { Entrainement } from './CarteEntrainement'

export default async function EntrainementPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Expire les corrections en_cours créées avant aujourd'hui
  const today = new Date().toISOString().slice(0, 10)
  await supabase
    .from('correction_tentative')
    .update({ statut: 'echec', updated_at: new Date().toISOString() })
    .eq('statut', 'en_cours')
    .lt('date_creation', today)

  const { data } = await supabase
    .from('entrainement')
    .select(`
      id,
      ref_exo,
      statut,
      date_creation,
      feuille_entrainement ( titre, correction ( pdf_url ) ),
      observation ( etat ),
      session ( temps_min, date ),
      erreur ( c1,c2,c3,c4,s1,s2,s3,s4,r1,r2,r3,r4 ),
      correction_tentative ( id, statut, date_creation )
    `)
    .eq('user_id', user.id)
    .order('date_creation', { ascending: false })

  const entrainements = (data ?? []) as unknown as Entrainement[]

  const enCours = entrainements.find((e) => e.statut === 'en_cours') ?? null

  const correctionEnCours = entrainements.find((e) =>
    e.correction_tentative?.some((c) => c.statut === 'en_cours')
  ) ?? null

  const canStartCorrection = !enCours && !correctionEnCours

  const termines = entrainements
    .filter((e) => e.statut !== 'en_cours' && e.id !== correctionEnCours?.id)
    .sort((a, b) => {
      const dateA = a.session.map((s) => s.date).sort().reverse()[0] ?? a.date_creation
      const dateB = b.session.map((s) => s.date).sort().reverse()[0] ?? b.date_creation
      return dateB.localeCompare(dateA)
    })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        <Link href="/" className="inline-block text-sm text-gray-400 hover:text-gray-700 transition-colors py-2 -my-2">← Monstro</Link>

        <EntrainementClient
          userId={user.id}
          enCours={enCours}
          correctionEnCours={correctionEnCours}
          termines={termines}
          canStartCorrection={canStartCorrection}
        />
      </div>
    </div>
  )
}
