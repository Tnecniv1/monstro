// Cœur de l'envoi du rapport hebdomadaire par WhatsApp via Twilio (template approuvé, Content API).
// Serveur uniquement : utilisé par la Server Action (admin connecté) et par le cron (client service role).
// Les identifiants Twilio ne quittent jamais le serveur.
import type { SupabaseClient } from '@supabase/supabase-js'
import twilio from 'twilio'

export type EnvoiWhatsAppResult = { ok: true; sid: string } | { ok: false; erreur: string }

// Messages lisibles pour les erreurs Twilio courantes (https://www.twilio.com/docs/api/errors).
// Les autres codes sont affichés avec le message d'origine de Twilio.
const ERREURS_TWILIO: Record<number, string> = {
  20003: 'Identifiants Twilio refusés (vérifier TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN).',
  20429: 'Trop de requêtes envoyées à Twilio : réessaie dans quelques instants.',
  21211: 'Numéro du destinataire invalide.',
  21408: "L'envoi vers le pays de ce numéro n'est pas autorisé sur le compte Twilio.",
  21606: "Le numéro d'envoi (TWILIO_WHATSAPP_FROM) ne peut pas envoyer ce message.",
  21610: 'Ce destinataire a refusé les messages (STOP).',
  63007: "Aucun expéditeur WhatsApp trouvé pour TWILIO_WHATSAPP_FROM sur le compte Twilio.",
  63018: "Limite d'envoi WhatsApp atteinte : réessaie plus tard.",
}

function lireEnv(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`Configuration manquante : variable d'environnement ${nom}.`)
  return valeur
}

async function tenterEnvoi(
  supabase: SupabaseClient,
  rapportId: string,
  referentId: string,
): Promise<EnvoiWhatsAppResult> {
  const { data: rapport } = await supabase
    .from('rapport_mensuel')
    .select('eleve_id, image_path')
    .eq('id', rapportId)
    .single()
  if (!rapport) return { ok: false, erreur: 'Rapport introuvable.' }
  if (!rapport.image_path) return { ok: false, erreur: "Génère le PNG avant d'envoyer le rapport." }

  // Le suiveur doit être rattaché (et actif) à l'élève du rapport
  const { data: lien } = await supabase
    .from('referent_eleve')
    .select('referent(telephone, mode)')
    .eq('eleve_id', rapport.eleve_id)
    .eq('referent_id', referentId)
    .eq('actif', true)
    .maybeSingle()
  const referent = (Array.isArray(lien?.referent) ? lien?.referent[0] : lien?.referent) as
    | { telephone: string | null; mode: string | null }
    | undefined
  if (!referent) return { ok: false, erreur: "Ce suiveur n'est pas rattaché à cet élève." }
  if (referent.mode === 'sms') return { ok: false, erreur: 'Ce suiveur est configuré pour les SMS, pas WhatsApp.' }

  // Téléphone stocké en chiffres sans « + » (normalizePhone) → E.164
  const chiffres = (referent.telephone ?? '').replace(/\D/g, '')
  if (!/^[1-9]\d{7,14}$/.test(chiffres)) {
    return { ok: false, erreur: `Numéro du suiveur invalide (« ${referent.telephone ?? ''} ») : format international attendu, ex. 33612345678.` }
  }

  const { data: eleve } = await supabase
    .from('user_profile')
    .select('prenom, pseudo')
    .eq('id', rapport.eleve_id)
    .single()
  const prenom = eleve?.prenom?.trim() || eleve?.pseudo?.trim() || 'votre enfant'

  let config: { accountSid: string; authToken: string; from: string; contentSid: string }
  try {
    config = {
      accountSid: lireEnv('TWILIO_ACCOUNT_SID'),
      authToken: lireEnv('TWILIO_AUTH_TOKEN'),
      from: lireEnv('TWILIO_WHATSAPP_FROM'),
      contentSid: lireEnv('TWILIO_CONTENT_SID'),
    }
  } catch (e) {
    return { ok: false, erreur: (e as Error).message }
  }
  // Twilio exige le préfixe « whatsapp: » sur l'expéditeur et le destinataire
  const from = config.from.startsWith('whatsapp:') ? config.from : `whatsapp:${config.from}`

  try {
    const message = await twilio(config.accountSid, config.authToken).messages.create({
      from,
      to: `whatsapp:+${chiffres}`,
      contentSid: config.contentSid,
      // {{1}} = prénom, {{2}} = nom du fichier dans le bucket public « rapports »
      contentVariables: JSON.stringify({ '1': prenom, '2': rapport.image_path }),
    })
    return { ok: true, sid: message.sid }
  } catch (e) {
    const err = e as { code?: number; status?: number; message?: string }
    console.error('[whatsapp] échec Twilio', { code: err.code, status: err.status, message: err.message })
    const lisible = err.code ? ERREURS_TWILIO[err.code] : undefined
    return {
      ok: false,
      erreur: lisible ?? `Twilio a refusé l'envoi${err.code ? ` (code ${err.code})` : ''} : ${err.message ?? 'erreur inconnue'}`,
    }
  }
}

/**
 * Envoie le rapport `rapportId` au suiveur `referentId` par WhatsApp, puis journalise la tentative
 * (rapport_envoi_log) et, en cas de succès, met à jour rapport_envoi et rapport_mensuel.envoye_le.
 */
export async function envoyerRapportWhatsApp(
  supabase: SupabaseClient,
  rapportId: string,
  referentId: string,
  declenchement: 'manuel' | 'auto',
): Promise<EnvoiWhatsAppResult> {
  const res = await tenterEnvoi(supabase, rapportId, referentId)

  // Le journal ne doit jamais faire échouer un envoi déjà parti : erreurs seulement tracées
  const { error: errLog } = await supabase.from('rapport_envoi_log').insert({
    rapport_id: rapportId,
    referent_id: referentId,
    canal: 'whatsapp',
    declenchement,
    statut: res.ok ? 'succes' : 'echec',
    erreur: res.ok ? null : res.erreur,
    twilio_sid: res.ok ? res.sid : null,
  })
  if (errLog) console.error('[whatsapp] journal non enregistré', errLog.message)

  if (res.ok) {
    const envoye_le = new Date().toISOString()
    await supabase
      .from('rapport_envoi')
      .upsert({ rapport_id: rapportId, referent_id: referentId, envoye_le }, { onConflict: 'rapport_id,referent_id' })
    await supabase.from('rapport_mensuel').update({ envoye_le }).eq('id', rapportId)
  }

  return res
}
