import { createClient } from './server'
import { redirect } from 'next/navigation'

export type UserProfile = {
  pseudo: string | null
  role: string | null
  avatar_url: string | null
}

export async function getUser() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profile')
    .select('pseudo, role, avatar_url')
    .eq('id', user.id)
    .single()

  return { user, profile: profile as UserProfile | null }
}
