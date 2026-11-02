// Import de l'historique WhatsApp Twilio dans whatsapp_message : messages reçus sur notre numéro et
// messages envoyés depuis celui-ci. Relançable : les twilio_sid déjà présents sont ignorés.
// Partagé par scripts/import-whatsapp-historique.ts et le bouton « Synchroniser avec Twilio » du
// Suivi. Serveur uniquement, avec le client service role.
import type { SupabaseClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { normaliserTelephone } from './telephone'
import { chargerIndexReferents, enregistrerMessageEntrant, insererMessageWhatsApp } from './whatsappMessage'

// Envois qui ne sont jamais arrivés : pas dans l'historique de conversation
const STATUTS_ECHEC = new Set(['failed', 'undelivered', 'canceled'])

export type ResumeImport = {
  recus: number
  entrantsImportes: number
  envoyes: number
  sortantsImportes: number
  echecsIgnores: number
}

function lireEnv(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`Variable d'environnement manquante : ${nom}`)
  return valeur
}

export async function importerHistoriqueWhatsApp(supabase: SupabaseClient): Promise<ResumeImport> {
  const accountSid = lireEnv('TWILIO_ACCOUNT_SID')
  const client = twilio(accountSid, lireEnv('TWILIO_AUTH_TOKEN'))
  const brut = lireEnv('TWILIO_WHATSAPP_FROM')
  const notreNumero = brut.startsWith('whatsapp:') ? brut : `whatsapp:${brut}`

  const trouverReferent = await chargerIndexReferents(supabase)

  // Rapport de chaque envoi déjà journalisé, retrouvé par son SID Twilio
  const { data: journal, error } = await supabase
    .from('rapport_envoi_log')
    .select('twilio_sid, rapport_id')
    .not('twilio_sid', 'is', null)
  if (error) throw new Error(`rapport_envoi_log illisible : ${error.message}`)
  const rapportParSid = new Map((journal ?? []).map((l) => [l.twilio_sid as string, l.rapport_id as string]))

  const recus = await client.messages.list({ to: notreNumero })
  let entrantsImportes = 0
  for (const m of recus) {
    let media: { url: string; contentType: string | null } | null = null
    if (Number(m.numMedia) > 0) {
      const [premier] = await client.messages(m.sid).media.list({ limit: 1 })
      if (premier) {
        media = {
          url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${m.sid}/Media/${premier.sid}`,
          contentType: premier.contentType,
        }
      }
    }
    const date = (m.dateSent ?? m.dateCreated).toISOString()
    if (await enregistrerMessageEntrant(supabase, { from: m.from, body: m.body, sid: m.sid, media, trouverReferent, createdAt: date })) {
      entrantsImportes++
    }
  }

  const envoyes = await client.messages.list({ from: notreNumero })
  let sortantsImportes = 0
  let echecsIgnores = 0
  for (const m of envoyes) {
    if (STATUTS_ECHEC.has(m.status)) {
      echecsIgnores++
      continue
    }
    const telephone = normaliserTelephone(m.to)
    const date = (m.dateSent ?? m.dateCreated).toISOString()
    const nouveau = await insererMessageWhatsApp(supabase, {
      telephone,
      referent_id: trouverReferent(telephone),
      sens: 'sortant',
      contenu: m.body || null,
      media_path: null,
      media_type: null,
      rapport_id: rapportParSid.get(m.sid) ?? null,
      twilio_sid: m.sid,
      lu_le: date,
      created_at: date,
    })
    if (nouveau) sortantsImportes++
  }

  return { recus: recus.length, entrantsImportes, envoyes: envoyes.length, sortantsImportes, echecsIgnores }
}
