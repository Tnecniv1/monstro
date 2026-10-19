// Envoi automatique hebdomadaire des rapports par WhatsApp, appelé par un Cron Job Render.
// Protégé par CRON_SECRET (en-tête « Authorization: Bearer <secret> »).
// Paramètre optionnel ?dry=1 : simule (ce qui partirait) sans rien générer, envoyer ni marquer.
// Reprenable : tout appel le jour réglé, de l'heure réglée à minuit, traite les envois manquants
// (lib/agora/envoiHebdo.ts) ; on peut donc appeler plusieurs fois sans double envoi.
import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { envoyerRapportsSemaine } from '@/lib/agora/envoiHebdo'
import { evaluerCreneau } from '@/lib/agora/planning'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function autorise(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const recu = Buffer.from(req.headers.get('authorization') ?? '')
  const attendu = Buffer.from(`Bearer ${secret}`)
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
}

async function traiter(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ erreur: 'CRON_SECRET non configuré sur le serveur' }, { status: 500 })
  }
  if (!autorise(req)) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const simulation = req.nextUrl.searchParams.get('dry') === '1'
  const supabase = createAdminClient()

  const { data: reglage, error: errReglage } = await supabase
    .from('agora_settings')
    .select('jour_semaine, heure, actif, dernier_envoi_auto')
    .eq('id', true)
    .single()
  if (errReglage || !reglage) {
    console.error('[cron rapports] réglage illisible', errReglage?.message)
    return NextResponse.json({ erreur: 'Réglage agora_settings introuvable (migration appliquée ?)' }, { status: 500 })
  }

  const { dansLeCreneau, lundiRapport, maintenant } = evaluerCreneau(reglage.jour_semaine, reglage.heure)
  const contexte = { maintenantParis: maintenant, lundiRapport, reglage, simulation }

  if (!reglage.actif && !simulation) return NextResponse.json({ ignore: 'envoi automatique désactivé', ...contexte })
  if (!dansLeCreneau && !simulation) return NextResponse.json({ ignore: 'hors créneau', ...contexte })

  let issue
  try {
    issue = await envoyerRapportsSemaine(supabase, lundiRapport, { declenchement: 'auto', simulation })
  } catch (e) {
    console.error('[cron rapports]', (e as Error).message)
    return NextResponse.json({ erreur: (e as Error).message, ...contexte }, { status: 500 })
  }
  if (issue.occupe) return NextResponse.json({ ignore: 'traitement déjà en cours', ...contexte })

  const { bilan, resultats, elevesBloques } = issue
  // Fin de traitement complet : dernière semaine envoyée, pour l'affichage seulement
  if (!simulation) {
    const { error } = await supabase
      .from('agora_settings')
      .update({ dernier_envoi_auto: lundiRapport, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (error) console.error('[cron rapports] dernier_envoi_auto non enregistré', error.message)
  }

  console.log('[cron rapports]', JSON.stringify({ lundiRapport, simulation, ...bilan }))
  for (const r of resultats.filter((x) => x.statut === 'echec')) {
    console.error('[cron rapports] échec', r.eleve, r.referent, r.erreur)
  }

  return NextResponse.json({ ...contexte, bilan, resultats, elevesBloques })
}

export const GET = traiter
export const POST = traiter
