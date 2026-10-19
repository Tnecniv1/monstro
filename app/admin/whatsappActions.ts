'use server'

// Envoi manuel du rapport par WhatsApp depuis l'Agora (admin connecté).
// Le cœur de l'envoi est partagé avec le cron : lib/whatsapp/envoyerRapport.ts.
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { chargerEligibiliteAgora, LIBELLES_BLOCAGE } from '@/lib/agora/eligibilite'
import { envoyerRapportsSemaine, type BilanEnvoi } from '@/lib/agora/envoiHebdo'
import { lundiDerniereSemaine } from '@/lib/agora/planning'
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

/**
 * Rattrapage : même logique que l'envoi automatique, hors créneau et pour la semaine `lundi`
 * (lundi ISO d'une semaine terminée). Seuls les suiveurs n'ayant pas encore reçu ce rapport sont
 * servis. Journalisé en « manuel ».
 */
export async function relancerEnvoiSemaineAction(
  lundi: string,
): Promise<{ ok: true; bilan: BilanEnvoi } | { ok: false; erreur: string }> {
  await requireAdmin()
  const date = new Date(`${lundi}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lundi) || Number.isNaN(date.getTime()) || date.getUTCDay() !== 1) {
    return { ok: false, erreur: 'Semaine invalide.' }
  }
  if (lundi > lundiDerniereSemaine()) return { ok: false, erreur: "Cette semaine n'est pas encore terminée." }

  try {
    const issue = await envoyerRapportsSemaine(createAdminClient(), lundi, { declenchement: 'manuel' })
    if (issue.occupe) return { ok: false, erreur: 'Un envoi est déjà en cours : réessaie dans quelques minutes.' }
    console.log('[rattrapage rapports]', JSON.stringify({ lundi, ...issue.bilan }))
    return { ok: true, bilan: issue.bilan }
  } catch (e) {
    console.error('[rattrapage rapports]', (e as Error).message)
    return { ok: false, erreur: `Envoi refusé : ${(e as Error).message}` }
  }
}
