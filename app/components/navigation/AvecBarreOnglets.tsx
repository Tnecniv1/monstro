import { createClient } from '@/lib/supabase/server'
import BarreOnglets from './BarreOnglets'

type ProfilBarre = { role: string | null; confidentiel: boolean | null }

// Pages élève principales (/, /parcours, /entrainement, /bibliotheque,
// /forum, /classement et leurs sous-pages) : barre d'onglets en bas et padding bas du
// contenu pour qu'elle ne masque rien. Sans utilisateur connecté, rien n'est
// ajouté. profil : déjà chargé par l'appelant (accueil) ; sinon lu ici.
export default async function AvecBarreOnglets({
  children,
  profil,
}: {
  children: React.ReactNode
  profil?: ProfilBarre | null
}) {
  let p = profil
  if (p === undefined) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return <>{children}</>
    const { data } = await supabase.from('user_profile').select('role, confidentiel').eq('id', user.id).single()
    p = (data as ProfilBarre | null) ?? null
  }

  // Même règle que l'accueil : un élève confidentiel n'a pas le Classement (les admins si).
  const afficherClassement = !(p?.confidentiel === true && p?.role !== 'admin')

  return (
    <>
      <div className="bg-bg pb-[calc(56px+env(safe-area-inset-bottom))]">{children}</div>
      <BarreOnglets afficherClassement={afficherClassement} />
    </>
  )
}
