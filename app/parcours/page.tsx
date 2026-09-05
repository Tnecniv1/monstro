import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TableauHistorique, { type EntHistorique } from './TableauHistorique'
import GraphiqueConcentration, { type SessionRaw } from './GraphiqueConcentration'
import GraphiqueTauxReussite from './GraphiqueTauxReussite'
import GraphiqueErreurs, { type ErreurRaw } from './GraphiqueErreurs'

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
      feuille_entrainement ( id, titre, volume, noeud:noeud_id ( nom ) ),
      observation ( etat ),
      session ( temps_min )
    `)
    .eq('user_id', user.id)
    .eq('statut', 'termine')
    .order('date_creation', { ascending: false })

  const historique = (historiqueRaw ?? []) as unknown as EntHistorique[]

  // Dataset 1b — feuilles en focus (pour le tri du tableau Historique)
  const { data: focusData } = await supabase
    .from('feuille_focus')
    .select('feuille_id')
    .eq('user_id', user.id)

  const focusIds = new Set(focusData?.map((f) => f.feuille_id) ?? [])

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

  // Dataset 3 — erreurs par entraînement
  const { data: erreursRaw } = await supabase
    .from('erreur')
    .select(`
      c1, c2, c3, c4,
      s1, s2, s3, s4,
      r1, r2, r3, r4,
      entrainement!inner(user_id, date_creation)
    `)
    .eq('entrainement.user_id', user.id)
    .order('entrainement(date_creation)', { ascending: true })

  const erreurs = (erreursRaw ?? []) as unknown as ErreurRaw[]

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

        <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">← Monstro</Link>
        <h1 className="text-2xl font-bold text-text-primary">Parcours</h1>

        {/* Section Historique */}
        <section className="space-y-3 bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Historique
          </h2>
          <TableauHistorique historique={historique} focusIds={focusIds} />
        </section>

        {/* Section Concentration */}
        <section className="space-y-3 bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Concentration
          </h2>
          <GraphiqueConcentration sessions={sessions} />
        </section>

        {/* Section Taux de réussite */}
        <section className="space-y-3 bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Taux de réussite
          </h2>
          <GraphiqueTauxReussite historique={historique} />
        </section>

        {/* Section Tendance des erreurs */}
        <section className="space-y-3 bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Tendance des erreurs
          </h2>
          <GraphiqueErreurs erreurs={erreurs} />
        </section>

      </div>
    </div>
  )
}
