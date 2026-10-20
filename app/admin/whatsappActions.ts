'use server'

// Envoi manuel du rapport par WhatsApp depuis l'Agora (admin connecté).
// Le cœur de l'envoi est partagé avec le cron : lib/whatsapp/envoyerRapport.ts.
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { chargerEligibiliteAgora, LIBELLES_BLOCAGE } from '@/lib/agora/eligibilite'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const supabase = createClient()

  // Agora coupé (aucun accès ou abonnement résilié) : refus côté serveur, quel que soit l'appelant
  const { data: rapport } = await supabase.from('rapport_mensuel').select('eleve_id').eq('id', rapportId).maybeSingle()
  if (!rapport) return { ok: false, erreur: 'Rapport introuvable.' }
  try {
    const motif = (await chargerEligibiliteAgora(createAdminClient()))(rapport.eleve_id)
    if (motif) return { ok: false, erreur: `${LIBELLES_BLOCAGE[motif]}.` }
  } catch (e) {
    console.error('[whatsapp] éligibilité Agora', (e as Error).message)
    return { ok: false, erreur: `Envoi refusé : ${(e as Error).message}` }
  }

  return envoyerRapportWhatsApp(supabase, rapportId, referentId, 'manuel')
}
