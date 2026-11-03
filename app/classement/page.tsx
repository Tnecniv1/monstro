import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ordinal,
  semaineParis,
  type Laureat,
  type LigneClassement,
  type NomVue,
  type VueClassement,
} from '@/lib/classement'
import ClassementClient from './ClassementClient'

// Podium : les 3 premières lignes ayant gagné des pixels. Liste : les suivantes
// ayant des pixels ou des jours actifs, plus l'élève connecté (même à 0).
// Le résultat de la RPC est déjà trié par rang : l'ordre est conservé.
function preparerVue(lignes: LigneClassement[], userId: string): VueClassement {
  const podium = lignes.filter((l) => l.pixels > 0).slice(0, 3)
  const dansPodium = new Set(podium.map((l) => l.user_id))
  const liste = lignes.filter(
    (l) =>
      !dansPodium.has(l.user_id) &&
      (l.pixels > 0 || l.jours_actifs > 0 || l.user_id === userId)
  )

  const index = lignes.findIndex((l) => l.user_id === userId)
  const moi = index >= 0 ? lignes[index] : null

  let message: string | null = null
  if (moi) {
    if (moi.rang === 1) {
      message = 'Tu es en tête.'
    } else {
      // Ligne la plus proche au-dessus de la mienne avec un rang strictement
      // meilleur (on saute les ex-aequo).
      const devant = lignes
        .slice(0, index)
        .reverse()
        .find((l) => l.rang < moi.rang)
      if (devant) {
        const ecart = devant.pixels - moi.pixels + 1
        message = `Encore ${ecart} px pour passer ${ordinal(devant.rang)}.`
      }
    }
  }

  return { podium, liste, moi, message }
}

export default async function ClassementPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const vueParam = Array.isArray(searchParams.vue) ? searchParams.vue[0] : searchParams.vue
  const vue: NomVue = vueParam === 'global' ? 'global' : 'semaine'

  // Semaine en cours et total depuis le début (éligibilité, pixels, rang
  // calculés en base) ; lauréats de la semaine précédente.
  const [semaine, global, etudiants] = await Promise.all([
    supabase.rpc('classement_semaine'),
    supabase.rpc('classement_global'),
    supabase.rpc('etudiant_de_la_semaine'),
  ])

  if (semaine.error) throw new Error(`classement_semaine : ${semaine.error.message}`)
  if (global.error) throw new Error(`classement_global : ${global.error.message}`)
  if (etudiants.error) throw new Error(`etudiant_de_la_semaine : ${etudiants.error.message}`)

  const vues: Record<NomVue, VueClassement> = {
    semaine: preparerVue((semaine.data ?? []) as LigneClassement[], user.id),
    global: preparerVue((global.data ?? []) as LigneClassement[], user.id),
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <ClassementClient
          vue={vue}
          vues={vues}
          etudiants={(etudiants.data ?? []) as Laureat[]}
          semaine={semaineParis()}
          userId={user.id}
        />
      </div>
    </div>
  )
}
