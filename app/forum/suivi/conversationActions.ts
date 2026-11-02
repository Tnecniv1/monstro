'use server'

// Conversations WhatsApp avec les suiveurs (table whatsapp_message), onglet Conversation du Suivi.
// Lecture et mise à jour avec la session admin (RLS admin) ; les médias du bucket privé
// whatsapp-media sont servis en URL signées, générées avec le client service role après requireAdmin().
import type { SupabaseClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { requireAdmin } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { importerHistoriqueWhatsApp, type ResumeImport } from '@/lib/twilio/importHistorique'
import { normaliserTelephone } from '@/lib/twilio/telephone'
import { chargerIndexReferents } from '@/lib/twilio/whatsappMessage'

export type { ResumeImport }

// Validité des URL signées : la vue est rechargée à chaque ouverture de l'onglet
const DUREE_URL_SIGNEE = 3600
// Taille de page PostgREST (max-rows par défaut de Supabase)
const PAGE = 1000
// Réponse libre WhatsApp : possible seulement 24 h après le dernier message du parent
const FENETRE_MS = 24 * 3_600_000
// Limite d'un message texte Twilio
const LONGUEUR_MAX = 1600

export type MessageWhatsApp = {
  id: string
  sens: 'entrant' | 'sortant'
  contenu: string | null
  media_type: string | null
  // URL signée du média entrant (null si absent ou non archivé)
  media_url: string | null
  // Image du rapport hebdomadaire envoyé (bucket public rapports)
  rapport_url: string | null
  lu_le: string | null
  created_at: string
}

export type ConversationWhatsApp = {
  telephone: string
  suiveur: { prenom: string | null; nom: string | null; relation: string | null; eleves: string[] } | null
  // Ordre chronologique
  messages: MessageWhatsApp[]
}

type LigneMessage = {
  id: string
  telephone: string
  referent_id: string | null
  sens: 'entrant' | 'sortant'
  contenu: string | null
  media_path: string | null
  media_type: string | null
  rapport_id: string | null
  lu_le: string | null
  created_at: string
}

type LigneSuiveur = {
  id: string
  prenom: string | null
  nom: string | null
  telephone: string | null
  relation: string | null
  referent_eleve: { actif: boolean; eleve: { prenom: string | null; pseudo: string | null } | null }[]
}

/** Toutes les conversations, de la plus récente à la plus ancienne. Appelée à l'ouverture de l'onglet. */
export async function chargerConversationsAction(): Promise<{ conversations: ConversationWhatsApp[]; erreur: string | null }> {
  await requireAdmin()
  const supabase = createClient()

  const lignes: LigneMessage[] = []
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase
      .from('whatsapp_message')
      .select('id, telephone, referent_id, sens, contenu, media_path, media_type, rapport_id, lu_le, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(debut, debut + PAGE - 1)
    if (error) return { conversations: [], erreur: error.message }
    lignes.push(...((data ?? []) as LigneMessage[]))
    if ((data?.length ?? 0) < PAGE) break
  }
  if (lignes.length === 0) return { conversations: [], erreur: null }

  const rapportIds = Array.from(new Set(lignes.flatMap((l) => (l.rapport_id ? [l.rapport_id] : []))))
  const mediaPaths = lignes.flatMap((l) => (l.media_path ? [l.media_path] : []))

  const [suiveursRes, rapportsRes, urlsRes] = await Promise.all([
    supabase
      .from('referent')
      .select('id, prenom, nom, telephone, relation, referent_eleve(actif, eleve:user_profile(prenom, pseudo))'),
    rapportIds.length ? supabase.from('rapport_mensuel').select('id, image_path').in('id', rapportIds) : null,
    mediaPaths.length
      ? createAdminClient().storage.from('whatsapp-media').createSignedUrls(mediaPaths, DUREE_URL_SIGNEE)
      : null,
  ])
  const erreur = suiveursRes.error?.message ?? rapportsRes?.error?.message ?? urlsRes?.error?.message
  if (erreur) return { conversations: [], erreur }

  const urlParMedia = new Map<string, string>()
  for (const u of urlsRes?.data ?? []) if (u.path && u.signedUrl) urlParMedia.set(u.path, u.signedUrl)
  const urlParRapport = new Map<string, string>()
  for (const r of rapportsRes?.data ?? []) {
    if (r.image_path) urlParRapport.set(r.id, supabase.storage.from('rapports').getPublicUrl(r.image_path).data.publicUrl)
  }

  const suiveurs = (suiveursRes.data ?? []) as unknown as LigneSuiveur[]
  const suiveurParId = new Map(suiveurs.map((s) => [s.id, s]))
  // Numéro dont aucun message ne porte de referent_id : premier suiveur ayant ce numéro
  const suiveurParTelephone = new Map<string, LigneSuiveur>()
  for (const s of suiveurs) {
    const tel = normaliserTelephone(s.telephone ?? '')
    if (tel && !suiveurParTelephone.has(tel)) suiveurParTelephone.set(tel, s)
  }

  const parTelephone = new Map<string, LigneMessage[]>()
  for (const l of lignes) {
    const liste = parTelephone.get(l.telephone)
    if (liste) liste.push(l)
    else parTelephone.set(l.telephone, [l])
  }

  const conversations = Array.from(parTelephone, ([telephone, messages]): ConversationWhatsApp => {
    const referentId = messages.findLast((m) => m.referent_id)?.referent_id
    const s = (referentId ? suiveurParId.get(referentId) : undefined) ?? suiveurParTelephone.get(telephone)
    return {
      telephone,
      suiveur: s
        ? {
            prenom: s.prenom,
            nom: s.nom,
            relation: s.relation,
            eleves: s.referent_eleve
              .filter((l) => l.actif && l.eleve)
              .map((l) => l.eleve?.prenom?.trim() || l.eleve?.pseudo?.trim() || '')
              .filter(Boolean),
          }
        : null,
      messages: messages.map((m) => ({
        id: m.id,
        sens: m.sens,
        contenu: m.contenu,
        media_type: m.media_type,
        media_url: m.media_path ? urlParMedia.get(m.media_path) ?? null : null,
        rapport_url: m.rapport_id ? urlParRapport.get(m.rapport_id) ?? null : null,
        lu_le: m.lu_le,
        created_at: m.created_at,
      })),
    }
  })
  const dernier = (c: ConversationWhatsApp) => Date.parse(c.messages[c.messages.length - 1].created_at)
  conversations.sort((a, b) => dernier(b) - dernier(a))
  return { conversations, erreur: null }
}

/** Marque lus les messages entrants non lus d'un numéro. Renvoie l'horodatage appliqué. */
export async function marquerConversationLueAction(
  telephone: string,
): Promise<{ lu_le: string | null; erreur: string | null }> {
  await requireAdmin()
  const lu_le = new Date().toISOString()
  const { error } = await createClient()
    .from('whatsapp_message')
    .update({ lu_le })
    .eq('telephone', telephone)
    .eq('sens', 'entrant')
    .is('lu_le', null)
  return error ? { lu_le: null, erreur: error.message } : { lu_le, erreur: null }
}

function lireEnv(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`Configuration manquante : variable d'environnement ${nom}.`)
  return valeur
}

// Suiveur d'une conversation, même règle que chargerConversationsAction : referent_id du dernier
// message qui en porte un, sinon premier suiveur ayant ce numéro une fois normalisé.
async function referentDuNumero(supabase: SupabaseClient, telephone: string): Promise<string | null> {
  const { data } = await supabase
    .from('whatsapp_message')
    .select('referent_id')
    .eq('telephone', telephone)
    .not('referent_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.referent_id) return data.referent_id
  return (await chargerIndexReferents(supabase))(telephone)
}

/**
 * Réponse libre (sans template) au parent d'une conversation. La fenêtre de 24 h est revérifiée
 * ici, jamais confiée au navigateur. `message` non null = parti chez Twilio (même si `erreur`
 * signale ensuite un échec d'enregistrement : ne pas renvoyer).
 */
export async function envoyerReponseAction(
  telephone: string,
  texte: string,
): Promise<{ message: MessageWhatsApp | null; erreur: string | null }> {
  const { user } = await requireAdmin()
  const contenu = texte.trim()
  if (!contenu) return { message: null, erreur: 'Le message est vide.' }
  if (contenu.length > LONGUEUR_MAX) {
    return { message: null, erreur: `Message trop long (${contenu.length} caractères, ${LONGUEUR_MAX} maximum).` }
  }
  if (!/^\d{6,15}$/.test(telephone)) return { message: null, erreur: 'Numéro invalide.' }

  const supabase = createAdminClient()
  const { data: dernierEntrant, error: errFenetre } = await supabase
    .from('whatsapp_message')
    .select('created_at')
    .eq('telephone', telephone)
    .eq('sens', 'entrant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (errFenetre) return { message: null, erreur: errFenetre.message }
  if (!dernierEntrant || Date.parse(dernierEntrant.created_at) + FENETRE_MS <= Date.now()) {
    return { message: null, erreur: 'Fenêtre fermée : le parent doit écrire en premier.' }
  }

  let sid: string
  try {
    const brut = lireEnv('TWILIO_WHATSAPP_FROM')
    const envoi = await twilio(lireEnv('TWILIO_ACCOUNT_SID'), lireEnv('TWILIO_AUTH_TOKEN')).messages.create({
      from: brut.startsWith('whatsapp:') ? brut : `whatsapp:${brut}`,
      to: `whatsapp:+${telephone}`,
      body: contenu,
    })
    sid = envoi.sid
  } catch (e) {
    const err = e as { code?: number; message?: string }
    console.error('[whatsapp] réponse non envoyée', err.code, err.message)
    if (err.code === 63016) {
      return { message: null, erreur: 'Fenêtre de 24 h dépassée selon WhatsApp : le parent doit écrire en premier.' }
    }
    return {
      message: null,
      erreur: `Twilio a refusé l'envoi${err.code ? ` (code ${err.code})` : ''} : ${err.message ?? 'erreur inconnue'}`,
    }
  }

  const lu_le = new Date().toISOString()
  const { data: ligne, error: errInsert } = await supabase
    .from('whatsapp_message')
    .insert({
      telephone,
      referent_id: await referentDuNumero(supabase, telephone),
      sens: 'sortant',
      contenu,
      twilio_sid: sid,
      envoye_par: user?.id ?? null,
      lu_le,
    })
    .select('id, created_at')
    .single()

  const message: MessageWhatsApp = {
    id: ligne?.id ?? sid,
    sens: 'sortant',
    contenu,
    media_type: null,
    media_url: null,
    rapport_url: null,
    lu_le,
    created_at: ligne?.created_at ?? lu_le,
  }
  if (errInsert) {
    console.error('[whatsapp] réponse envoyée mais non enregistrée', sid, errInsert.message)
    return { message, erreur: `Message envoyé, mais non enregistré dans l'historique : ${errInsert.message}` }
  }
  return { message, erreur: null }
}

/** Bouton « Synchroniser avec Twilio » : importe les messages Twilio absents de whatsapp_message. */
export async function synchroniserTwilioAction(): Promise<{ resume: ResumeImport | null; erreur: string | null }> {
  await requireAdmin()
  try {
    return { resume: await importerHistoriqueWhatsApp(createAdminClient()), erreur: null }
  } catch (e) {
    const err = e as { code?: number; message?: string }
    console.error('[whatsapp] synchronisation Twilio', err.code, err.message)
    const detail = err.code === 20003 ? 'identifiants Twilio refusés.' : err.message ?? 'erreur inconnue.'
    return { resume: null, erreur: `Synchronisation impossible : ${detail}` }
  }
}
