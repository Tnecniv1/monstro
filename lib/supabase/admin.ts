import { createClient } from '@supabase/supabase-js'

// Client « service role » : contourne la RLS. Réservé au code serveur sans session
// utilisateur (cron d'envoi automatique) — ne jamais l'importer depuis un composant client.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
