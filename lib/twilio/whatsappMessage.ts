// Historique des conversations WhatsApp (table whatsapp_message, bucket privé whatsapp-media).
// Serveur uniquement, avec le client service role : partagé par le webhook Twilio, l'envoi du
// rapport et le script d'import de l'historique.
import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliserTelephone } from './telephone'

const BUCKET_MEDIA = 'whatsapp-media'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'application/pdf': 'pdf', 'text/vcard': 'vcf',
}

function extension(contentType: string): string {
  const type = contentType.split(';')[0].trim().toLowerCase()
  return EXTENSIONS[type] ?? (type.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin')
}

export type LigneWhatsApp = {
  telephone: string
  referent_id: string | null
  sens: 'entrant' | 'sortant'
  contenu: string | null
  media_path: string | null
  media_type: string | null
  rapport_id: string | null
  twilio_sid: string
  lu_le: string | null
  created_at?: string
}

/** Insère la ligne ; un twilio_sid déjà présent est ignoré sans erreur. true si la ligne est nouvelle. */
export async function insererMessageWhatsApp(supabase: SupabaseClient, ligne: LigneWhatsApp): Promise<boolean> {
  const { data, error } = await supabase
    .from('whatsapp_message')
    .upsert(ligne, { onConflict: 'twilio_sid', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(`whatsapp_message : ${error.message}`)
  return (data?.length ?? 0) > 0
}

/** Numéro normalisé → id du premier suiveur ayant ce numéro (une fois normalisé), ou null. */
export async function chargerIndexReferents(supabase: SupabaseClient): Promise<(telephone: string) => string | null> {
  const { data, error } = await supabase.from('referent').select('id, telephone')
  if (error) throw new Error(`Suiveurs illisibles : ${error.message}`)
  const index = new Map<string, string>()
  for (const r of data ?? []) {
    const tel = normaliserTelephone(r.telephone ?? '')
    if (tel && !index.has(tel)) index.set(tel, r.id)
  }
  return (telephone) => index.get(telephone) ?? null
}

/**
 * Télécharge un média Twilio (basic auth) et le range dans whatsapp-media sous {telephone}/{sid}.{ext}.
 * Renvoie le chemin, ou null en cas d'échec (journalisé) : le message est enregistré quand même.
 */
async function archiverMedia(
  supabase: SupabaseClient,
  m: { url: string; contentType: string | null; telephone: string; sid: string },
): Promise<string | null> {
  try {
    const identifiants = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const rep = await fetch(m.url, { headers: { Authorization: `Basic ${identifiants}` } })
    if (!rep.ok) throw new Error(`téléchargement HTTP ${rep.status}`)
    const type = m.contentType || rep.headers.get('content-type') || 'application/octet-stream'
    const chemin = `${m.telephone}/${m.sid}.${extension(type)}`
    const { error } = await supabase.storage
      .from(BUCKET_MEDIA)
      .upload(chemin, await rep.arrayBuffer(), { contentType: type, upsert: true })
    if (error) throw new Error(`upload : ${error.message}`)
    return chemin
  } catch (e) {
    console.error('[whatsapp] média non archivé', m.sid, (e as Error).message)
    return null
  }
}

/**
 * Enregistre un message reçu (lu_le null) : normalise le numéro, rapproche le suiveur, archive le
 * premier média. Un MessageSid déjà présent est ignoré avant tout téléchargement.
 */
export async function enregistrerMessageEntrant(
  supabase: SupabaseClient,
  m: {
    from: string
    body: string | null
    sid: string
    media: { url: string; contentType: string | null } | null
    trouverReferent: (telephone: string) => string | null
    createdAt?: string
  },
): Promise<boolean> {
  const { data: existant } = await supabase.from('whatsapp_message').select('id').eq('twilio_sid', m.sid).maybeSingle()
  if (existant) return false

  const telephone = normaliserTelephone(m.from)
  const media_path = m.media ? await archiverMedia(supabase, { ...m.media, telephone, sid: m.sid }) : null
  return insererMessageWhatsApp(supabase, {
    telephone,
    referent_id: m.trouverReferent(telephone),
    sens: 'entrant',
    contenu: m.body || null,
    media_path,
    media_type: m.media?.contentType ?? null,
    rapport_id: null,
    twilio_sid: m.sid,
    lu_le: null,
    ...(m.createdAt ? { created_at: m.createdAt } : {}),
  })
}
