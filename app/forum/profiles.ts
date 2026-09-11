import type { SupabaseClient } from '@supabase/supabase-js'

// Les tables forum_* ne portent qu'un user_id — pas de jointure FK garantie
// vers user_profile — on résout donc les pseudos séparément par lot,
// comme le fait déjà app/classement/page.tsx.
export async function fetchPseudoMap(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) return new Map()

  const { data } = await supabase.from('user_profile').select('id, pseudo').in('id', uniqueIds)

  const map = new Map<string, string>()
  ;(data ?? []).forEach((p: { id: string; pseudo: string | null }) => {
    map.set(p.id, p.pseudo ?? '—')
  })
  return map
}
