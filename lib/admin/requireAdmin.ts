import { getUser } from '../supabase/getUser'
import { redirect } from 'next/navigation'

export async function requireAdmin() {
  const { user, profile } = await getUser()
  if (profile?.role !== 'admin') redirect('/')
  return { user, profile }
}
