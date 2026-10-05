import type { createClient } from '@/lib/supabase/server'
import type { DonneesParcours } from './etapes'

type Supabase = ReturnType<typeof createClient>

// Tout sauf pixels, déjà renvoyé par la RPC get_parcours_admin().
export type DonneesBrutes = Omit<DonneesParcours, 'pixels'>

// PostgREST plafonne chaque réponse à 1000 lignes.
const PAGE = 1000

async function toutesLesLignes<T>(
  page: (de: number, a: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await page(de, de + PAGE - 1)
    if (error) throw new Error(error.message)
    const lot = (data ?? []) as T[]
    lignes.push(...lot)
    if (lot.length < PAGE) return lignes
  }
}

// Données brutes des étapes 1 à 8, par élève. La RPC get_parcours_admin() ne
// renvoie que des dates déjà passées par la règle linéaire (tout est vide
// après la première étape manquante) : on relit donc les tables sources.
// Lecture avec la session de l'admin, autorisée par la RLS.
export async function chargerDonneesParcours(supabase: Supabase, ids: string[]): Promise<Map<string, DonneesBrutes>> {
  const donnees = new Map<string, DonneesBrutes>()
  if (ids.length === 0) return donnees

  const [profils, entrainements, sessions] = await Promise.all([
    toutesLesLignes<Omit<DonneesBrutes, 'a_entrainement' | 'a_session' | 'a_entrainement_termine'> & { id: string }>(
      (de, a) =>
        supabase
          .from('user_profile')
          .select(
            'id, parcours_debut_at, parcours_legacy, charte_acceptee_at, invitation_script1_vue_at, script1_ouvert_at, premier_focus_at'
          )
          .in('id', ids)
          .order('id')
          .range(de, a)
    ),
    toutesLesLignes<{ user_id: string; termine_at: string | null }>((de, a) =>
      supabase.from('entrainement').select('user_id, termine_at').in('user_id', ids).order('id').range(de, a)
    ),
    toutesLesLignes<{ entrainement: { user_id: string } }>((de, a) =>
      supabase
        .from('session')
        .select('entrainement!inner(user_id)')
        .in('entrainement.user_id', ids)
        .order('id')
        .range(de, a)
    ),
  ])

  for (const { id, ...p } of profils) {
    donnees.set(id, {
      ...p,
      parcours_legacy: p.parcours_legacy === true,
      a_entrainement: false,
      a_session: false,
      a_entrainement_termine: false,
    })
  }
  for (const e of entrainements) {
    const d = donnees.get(e.user_id)
    if (!d) continue
    d.a_entrainement = true
    if (e.termine_at != null) d.a_entrainement_termine = true
  }
  for (const s of sessions) {
    const d = donnees.get(s.entrainement.user_id)
    if (d) d.a_session = true
  }
  return donnees
}
