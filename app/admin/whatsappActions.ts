'use server'

// Envoi manuel du rapport par WhatsApp depuis l'Agora (admin connecté).
// Le cœur de l'envoi est partagé avec le cron : lib/whatsapp/envoyerRapport.ts.
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createClient } from '@/lib/supabase/server'
import { envoyerRapportWhatsApp, type EnvoiWhatsAppResult } from '@/lib/whatsapp/envoyerRapport'

export type { EnvoiWhatsAppResult }

/**
 * Envoie le rapport `rapportId` au suiveur `referentId` par WhatsApp.
 * Le numéro, le prénom de l'élève et le nom du fichier image sont relus en base :
 * le navigateur ne fournit que des identifiants.
 */
export async function envoyerRapportWhatsAppAction(
  rapportId: string,
  referentId: string,
): Promise<EnvoiWhatsAppResult> {
  await requireAdmin()
  return envoyerRapportWhatsApp(createClient(), rapportId, referentId, 'manuel')
}
