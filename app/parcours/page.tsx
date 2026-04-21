import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TableauHistorique, { type EntHistorique } from './TableauHistorique'
import GraphiqueConcentration, { type SessionRaw } from './GraphiqueConcentration'
import GraphiqueTauxReussite from './GraphiqueTauxReussite'

export default async function ParcoursPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Dataset 1 — historique terminé
  const { data: historiqueRaw } = await supabase
    .from('entrainement')
    .select(`
      id, date_creation, ref_exo, statut,
      feuille_entrainement ( titre, volume, noeud:noeud_id ( nom ) ),
      observation ( etat ),
      session ( temps_min )
    `)
    .eq('user_id', user.id)
    .eq('statut', 'termine')
    .order('date_creation', { ascending: false })

  const historique = (historiqueRaw ?? []) as unknown as EntHistorique[]

  // Dataset 2 — sessions (via ids des entraînements de l'utilisateur)
  const { data: entIds } = await supabase
    .from('entrainement')
    .select('id')
    .eq('user_id', user.id)

  const ids = entIds?.map((e) => e.id) ?? []

  const { data: sessionsRaw } = ids.length > 0
    ? await supabase
        .from('session')
        .select('date, temps_min, entrainement_id')
        .in('entrainement_id', ids)
        .order('date', { ascending: true })
    : { data: [] }

  const sessions = (sessionsRaw ?? []) as unknown as SessionRaw[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-gray-900">Parcours</h1>

        {/* Section Historique */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Historique
          </h2>
          <TableauHistorique historique={historique} />
        </section>

        {/* Section Concentration */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Concentration
          </h2>
          <GraphiqueConcentration sessions={sessions} />
        </section>

        {/* Section Taux de réussite */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
            Taux de réussite
          </h2>
          <GraphiqueTauxReussite historique={historique} />
        </section>

      </div>
    </div>
  )
}
