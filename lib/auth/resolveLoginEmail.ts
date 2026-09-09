import type { SupabaseClient } from '@supabase/supabase-js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function resolveLoginEmail(
  supabase: SupabaseClient,
  identifier: string
): Promise<{ email: string | null; error: string | null }> {
  const trimmed = identifier.trim()
  if (EMAIL_REGEX.test(trimmed)) {
    return { email: trimmed, error: null }
  }
  const { data, error } = await supabase.rpc('get_email_by_pseudo', { p_pseudo: trimmed })
  if (error || !data) {
    return { email: null, error: 'Pseudo introuvable' }
  }
  return { email: data, error: null }
}
