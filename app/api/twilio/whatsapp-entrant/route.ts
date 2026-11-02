// Webhook Twilio des messages WhatsApp reçus (réponses des parents au numéro d'envoi des rapports).
// Sans session : authentifié par la signature X-Twilio-Signature, calculée par Twilio sur l'URL
// publique ci-dessous (et non sur l'URL interne derrière le proxy Render).
import { NextResponse, type NextRequest } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerIndexReferents, enregistrerMessageEntrant } from '@/lib/twilio/whatsappMessage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const URL_PUBLIQUE = 'https://www.monstro.fr/api/twilio/whatsapp-entrant'

// TwiML vide : aucune réponse automatique au parent
function twimlVide() {
  return new NextResponse('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error('[whatsapp entrant] TWILIO_AUTH_TOKEN non configuré')
    return new NextResponse('Configuration manquante', { status: 500 })
  }

  const params: Record<string, string> = {}
  ;(await req.formData()).forEach((valeur, cle) => {
    if (typeof valeur === 'string') params[cle] = valeur
  })
  const signature = req.headers.get('x-twilio-signature') ?? ''
  if (!twilio.validateRequest(authToken, signature, URL_PUBLIQUE, params)) {
    return new NextResponse('Signature invalide', { status: 403 })
  }

  const { From, Body, MessageSid, MediaUrl0, MediaContentType0 } = params
  if (!From || !MessageSid) return twimlVide()

  try {
    const supabase = createAdminClient()
    await enregistrerMessageEntrant(supabase, {
      from: From,
      body: Body ?? null,
      sid: MessageSid,
      media: Number(params.NumMedia ?? 0) > 0 && MediaUrl0 ? { url: MediaUrl0, contentType: MediaContentType0 ?? null } : null,
      trouverReferent: await chargerIndexReferents(supabase),
    })
  } catch (e) {
    console.error('[whatsapp entrant]', MessageSid, (e as Error).message)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
  return twimlVide()
}
