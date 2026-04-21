import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EntrainementClient from './EntrainementClient'
import CarteEntrainement, { type Entrainement } from './CarteEntrainement'

export default async function EntrainementPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('entrainement')
    .select(`
      id,
      ref_exo,
      statut,
      date_creation,
      feuille_entrainement ( titre ),
      observation ( etat ),
      session ( temps_min )
    `)
    .eq('user_id', user.id)
    .order('date_creation', { ascending: false })

  const entrainements = (data ?? []) as unknown as Entrainement[]

  const enCours = entrainements.find((e) => e.statut === 'en_cours') ?? null
  const termines = entrainements.filter((e) => e.statut !== 'en_cours')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-gray-900">Entraînements</h1>

        {/* Entraînement en cours */}
        {enCours && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              En cours
            </h2>
            <CarteEntrainement e={enCours} enCours />
          </section>
        )}

        {/* Bouton + modale nouvel entraînement */}
        <EntrainementClient userId={user.id} enCours={!!enCours} />

        {/* Historique */}
        {termines.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Historique
            </h2>
            <div className="space-y-3">
              {termines.map((e) => (
                <CarteEntrainement key={e.id} e={e} />
              ))}
            </div>
          </section>
        )}

        {termines.length === 0 && !enCours && (
          <p className="text-center text-sm text-gray-400 py-12">
            Aucun entraînement pour l&apos;instant.
          </p>
        )}
      </div>
    </div>
  )
}
