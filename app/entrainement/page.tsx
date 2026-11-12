import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EntrainementClient from './EntrainementClient'
import EnonceFlottant from '../components/enonce/EnonceFlottant'
import { chargerExerciceEnCours } from '@/lib/exerciceEnCours'
import type { Entrainement } from './CarteEntrainement'

// ?feuille=<id>&exo=<n> (COMMENCER de l'accueil parcours) : modale pré-remplie.
function lirePreselection(searchParams: { [key: string]: string | string[] | undefined }) {
  const feuille = Array.isArray(searchParams.feuille) ? searchParams.feuille[0] : searchParams.feuille
  const exoBrut = Array.isArray(searchParams.exo) ? searchParams.exo[0] : searchParams.exo
  const exo = exoBrut ? Number(exoBrut) : NaN
  if (!feuille || !Number.isInteger(exo) || exo < 1) return null
  return { feuilleId: feuille, exo }
}

export default async function EntrainementPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
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

  // Énoncé flottant : lu après l'expiration des corrections ci-dessus.
  const exerciceEnCours = await chargerExerciceEnCours(supabase, user.id).catch((e: Error) => {
    console.error('[entrainement] exercice en cours', e.message)
    return null
  })

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
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        <Link href="/" className="inline-block text-sm text-text-muted hover:text-text-secondary transition-colors py-2 -my-2">← Monstro</Link>

        <EntrainementClient
          userId={user.id}
          enCours={enCours}
          correctionEnCours={correctionEnCours}
          termines={termines}
          canStartCorrection={canStartCorrection}
          preselection={lirePreselection(searchParams)}
        />
      </div>
      <EnonceFlottant exercice={exerciceEnCours} userId={user.id} />
    </div>
  )
}
