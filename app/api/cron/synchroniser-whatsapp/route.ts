// Synchronisation quotidienne de l'historique WhatsApp (messages Twilio absents de whatsapp_message),
// appelée par un Cron Job Render. Protégée par CRON_SECRET (en-tête « Authorization: Bearer <secret> »).
// Render planifie en UTC : le job tourne à 6 h et 7 h UTC, et seul l'appel de 8 h heure de Paris
// synchronise, été comme hiver. Paramètre optionnel ?force=1 : synchronise quelle que soit l'heure.
import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { importerHistoriqueWhatsApp } from '@/lib/twilio/importHistorique'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HEURE_PARIS = 8

function autorise(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const recu = Buffer.from(req.headers.get('authorization') ?? '')
  const attendu = Buffer.from(`Bearer ${secret}`)
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
}

function heureParis(): number {
  return Number(
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date()),
  )
}

async function traiter(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ erreur: 'CRON_SECRET non configuré sur le serveur' }, { status: 500 })
  }
  if (!autorise(req)) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const heure = heureParis()
  if (heure !== HEURE_PARIS && req.nextUrl.searchParams.get('force') !== '1') {
    return NextResponse.json({ ignore: 'hors créneau', heureParis: heure })
  }

  try {
    const resume = await importerHistoriqueWhatsApp(createAdminClient())
    console.log('[cron whatsapp]', JSON.stringify(resume))
    return NextResponse.json(resume)
  } catch (e) {
    console.error('[cron whatsapp]', (e as Error).message)
    return NextResponse.json({ erreur: (e as Error).message }, { status: 500 })
  }
}

export const GET = traiter
export const POST = traiter
