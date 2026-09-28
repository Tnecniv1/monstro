// Envoi automatique hebdomadaire des rapports par WhatsApp, appelé par un Cron Job Render.
// Protégé par CRON_SECRET (en-tête « Authorization: Bearer <secret> »).
// Paramètre optionnel ?dry=1 : simule (ce qui partirait) sans rien générer, envoyer ni marquer.
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { evaluerCreneau } from '@/lib/agora/planning'
import { genererImageRapport } from '@/lib/rapport/imageServeur'
import { getUserStatsForWeek } from '@/lib/stats/getUserStats'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerRapportWhatsApp } from '@/lib/whatsapp/envoyerRapport'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Resultat = { eleve: string; referent: string; statut: 'succes' | 'echec' | 'deja_envoye' | 'simulation'; erreur?: string }

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

  const { dansLeCreneau, lundiCourant, lundiRapport, maintenant } = evaluerCreneau(reglage.jour_semaine, reglage.heure)
  const contexte = { maintenantParis: maintenant, lundiCourant, lundiRapport, reglage, simulation }

  if (!reglage.actif && !simulation) return NextResponse.json({ ignore: 'envoi automatique désactivé', ...contexte })
  if (!dansLeCreneau && !simulation) return NextResponse.json({ ignore: 'hors créneau', ...contexte })
  if (reglage.dernier_envoi_auto === lundiCourant && !simulation) {
    return NextResponse.json({ ignore: 'déjà envoyé cette semaine', ...contexte })
  }

  // Idempotence : on « réserve » la semaine AVANT d'envoyer. Si deux appels se chevauchent,
  // un seul obtient la ligne ; en cas de plantage en cours de route, pas de double envoi.
  if (!simulation) {
    const { data: reserve } = await supabase
      .from('agora_settings')
      .update({ dernier_envoi_auto: lundiCourant, updated_at: new Date().toISOString() })
      .eq('id', true)
      .or(`dernier_envoi_auto.is.null,dernier_envoi_auto.neq.${lundiCourant}`)
      .select('id')
    if (!reserve || reserve.length === 0) {
      return NextResponse.json({ ignore: 'déjà en cours ou envoyé cette semaine', ...contexte })
    }
  }

  // Suiveurs actifs en WhatsApp, regroupés par élève (faux comptes exclus, comme dans l'Agora)
  const [{ data: liens }, { data: faux }] = await Promise.all([
    supabase.from('referent_eleve').select('eleve_id, referent(id, prenom, nom, mode)').eq('actif', true),
    supabase.rpc('get_fake_user_ids'),
  ])
  const fauxIds = new Set(((faux ?? []) as { user_id: string }[]).map((f) => f.user_id))
  const parEleve = new Map<string, { id: string; nom: string }[]>()
  for (const lien of (liens ?? []) as { eleve_id: string; referent: unknown }[]) {
    const r = (Array.isArray(lien.referent) ? lien.referent[0] : lien.referent) as
      | { id: string; prenom: string | null; nom: string | null; mode: string | null }
      | undefined
    if (!r || r.mode === 'sms' || fauxIds.has(lien.eleve_id)) continue
    const nom = [r.prenom, r.nom].filter(Boolean).join(' ') || r.id
    parEleve.set(lien.eleve_id, [...(parEleve.get(lien.eleve_id) ?? []), { id: r.id, nom }])
  }

  const resultats: Resultat[] = []
  for (const [eleveId, referents] of Array.from(parEleve)) {
    try {
      // Rapport de la semaine : créé s'il n'existe pas encore (mêmes champs que l'Agora)
      let { data: rapport } = await supabase
        .from('rapport_mensuel')
        .select('id, image_path, problemes_travailles, problemes_travailles_prev, minutes_concentration, minutes_concentration_prev, taux_reussite, taux_reussite_prev, problemes_reussis')
        .eq('eleve_id', eleveId)
        .eq('mois', lundiRapport)
        .maybeSingle()

      if (simulation) {
        for (const ref of referents) {
          resultats.push({ eleve: eleveId, referent: ref.nom, statut: 'simulation', erreur: rapport?.image_path ? undefined : 'image à générer' })
        }
        continue
      }

      if (!rapport) {
        const stats = await getUserStatsForWeek(eleveId, lundiRapport, supabase)
        const { data: cree, error } = await supabase
          .from('rapport_mensuel')
          .insert({
            eleve_id: eleveId,
            mois: lundiRapport,
            problemes_travailles: stats.problemesTravailles,
            problemes_travailles_prev: stats.problemesTravaillesPrev,
            minutes_concentration: stats.minutesConcentration,
            minutes_concentration_prev: stats.minutesConcentrationPrev,
            taux_reussite: stats.tauxReussite,
            taux_reussite_prev: stats.tauxReussitePrev,
            problemes_reussis: stats.problemesReussis,
          })
          .select('id, image_path, problemes_travailles, problemes_travailles_prev, minutes_concentration, minutes_concentration_prev, taux_reussite, taux_reussite_prev, problemes_reussis')
          .single()
        if (error || !cree) throw new Error(`création du rapport impossible : ${error?.message}`)
        rapport = cree
      }

      // Image : générée côté serveur seulement si l'admin ne l'a pas déjà fait (même nommage que genererPng)
      if (!rapport.image_path) {
        const png = await genererImageRapport(
          {
            problemesTravailles: rapport.problemes_travailles ?? 0,
            problemesTravaillesPrev: rapport.problemes_travailles_prev ?? 0,
            minutesConcentration: rapport.minutes_concentration ?? 0,
            minutesConcentrationPrev: rapport.minutes_concentration_prev ?? 0,
            tauxReussite: rapport.taux_reussite ?? 0,
            tauxReussitePrev: rapport.taux_reussite_prev ?? 0,
            problemesReussis: rapport.problemes_reussis ?? 0,
          },
          lundiRapport,
        )
        const chemin = `progression_${randomUUID().replace(/-/g, '').slice(0, 12)}.png`
        const { error: errUpload } = await supabase.storage
          .from('rapports')
          .upload(chemin, png, { upsert: true, contentType: 'image/png', cacheControl: '0' })
        if (errUpload) throw new Error(`upload de l'image impossible : ${errUpload.message}`)
        await supabase.from('rapport_mensuel').update({ image_path: chemin }).eq('id', rapport.id)
        rapport = { ...rapport, image_path: chemin }
      }

      // Envoi à chaque suiveur, sauf s'il l'a déjà reçu (envoi manuel dans la semaine)
      const { data: dejaEnvoyes } = await supabase.from('rapport_envoi').select('referent_id').eq('rapport_id', rapport.id)
      const deja = new Set(((dejaEnvoyes ?? []) as { referent_id: string }[]).map((e) => e.referent_id))
      for (const ref of referents) {
        if (deja.has(ref.id)) {
          resultats.push({ eleve: eleveId, referent: ref.nom, statut: 'deja_envoye' })
          continue
        }
        const res = await envoyerRapportWhatsApp(supabase, rapport.id, ref.id, 'auto')
        resultats.push({ eleve: eleveId, referent: ref.nom, statut: res.ok ? 'succes' : 'echec', erreur: res.ok ? undefined : res.erreur })
      }
    } catch (e) {
      const erreur = (e as Error).message
      console.error('[cron rapports] élève', eleveId, erreur)
      for (const ref of referents) resultats.push({ eleve: eleveId, referent: ref.nom, statut: 'echec', erreur })
    }
  }

  const bilan = {
    succes: resultats.filter((r) => r.statut === 'succes').length,
    echecs: resultats.filter((r) => r.statut === 'echec').length,
    dejaEnvoyes: resultats.filter((r) => r.statut === 'deja_envoye').length,
  }
  console.log('[cron rapports]', JSON.stringify({ lundiRapport, simulation, ...bilan }))
  for (const r of resultats.filter((x) => x.statut === 'echec')) {
    console.error('[cron rapports] échec', r.eleve, r.referent, r.erreur)
  }

  return NextResponse.json({ ...contexte, bilan, resultats })
}

export const GET = traiter
export const POST = traiter
