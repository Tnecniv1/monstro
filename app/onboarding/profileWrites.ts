import { createClient } from '@/lib/supabase/client'

// Même écriture que app/profil/ProfilClient.tsx (update côté client sur
// user_profile, filtré par id), plus .select('id') : une mise à jour bloquée
// par la RLS ne renvoie pas d'erreur, juste 0 ligne — on la traite comme un
// échec pour ne pas faire avancer le parcours à tort.

export const SCRIPT1_OUVERT_EVENT = 'onboarding:script1-ouvert'

type WriteResult = { ok: true } | { ok: false; error: string }

async function stampProfile(
  userId: string,
  column: 'charte_acceptee_at' | 'script1_ouvert_at'
): Promise<WriteResult> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_profile')
    .update({ [column]: new Date().toISOString() })
    .eq('id', userId)
    .select('id')

  if (error) {
    console.error(`[onboarding] échec de l'écriture de ${column}`, error)
    return { ok: false, error: error.message }
  }
  if (!data || data.length === 0) {
    console.error(`[onboarding] ${column} : 0 ligne mise à jour (RLS ?)`, { userId })
    return { ok: false, error: '0 ligne mise à jour' }
  }
  return { ok: true }
}

export function markCharteAcceptee(userId: string): Promise<WriteResult> {
  return stampProfile(userId, 'charte_acceptee_at')
}

// Prévient OnboardingGate (monté dans le layout, état séparé) que le
// Script 1 a été ouvert, pour qu'il ne propose plus le modal d'invitation.
export async function markScript1Ouvert(userId: string): Promise<WriteResult> {
  const result = await stampProfile(userId, 'script1_ouvert_at')
  if (result.ok) window.dispatchEvent(new Event(SCRIPT1_OUVERT_EVENT))
  return result
}
