// Envoi du rapport d'une semaine à tous les suiveurs WhatsApp des élèves éligibles.
// Partagé par le cron (envoi automatique) et le bouton de rattrapage de l'Agora.
// Reprenable : seuls les couples rapport/suiveur absents de rapport_envoi sont traités, on peut
// donc relancer autant de fois que nécessaire sans double envoi.
// Serveur uniquement : `supabase` doit être le client service role.
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargerEligibiliteAgora, type MotifBlocage } from '@/lib/agora/eligibilite'
import { genererImageRapport } from '@/lib/rapport/imageServeur'
import { getUserStatsForWeek } from '@/lib/stats/getUserStats'
import { envoyerRapportWhatsApp } from '@/lib/whatsapp/envoyerRapport'

export type ResultatEnvoi = {
  eleve: string
  referent: string
  statut: 'succes' | 'echec' | 'deja_envoye' | 'sms_saute' | 'simulation'
  erreur?: string
}

export type BilanEnvoi = {
  succes: number
  echecs: number
  dejaEnvoyes: number
  smsSautes: number
  elevesBloques: number
}

export type IssueEnvoi =
  | { occupe: true }
  | { occupe: false; resultats: ResultatEnvoi[]; bilan: BilanEnvoi; elevesBloques: Record<string, MotifBlocage> }

type Suiveur = { id: string; nom: string; mode: string | null }

const COLONNES_RAPPORT =
  'id, image_path, problemes_travailles, problemes_travailles_prev, minutes_concentration, minutes_concentration_prev, taux_reussite, taux_reussite_prev, problemes_reussis'

// Laisse le serveur souffler entre deux élèves (mémoire native de l'image rendue, débit Twilio)
const PAUSE_ENTRE_ELEVES_MS = 300

const MOTIF_SMS = "Suiveur en mode SMS : pas d'envoi automatique, à envoyer depuis le panneau de l'élève."

// Un seul traitement à la fois dans ce process (appels du cron qui se chevauchent, bouton de
// rattrapage pendant le cron) : deux traitements simultanés pourraient envoyer deux fois au même suiveur.
let enCours = false

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function statsEnColonnes(stats: Awaited<ReturnType<typeof getUserStatsForWeek>>) {
  return {
    problemes_travailles: stats.problemesTravailles,
    problemes_travailles_prev: stats.problemesTravaillesPrev,
    minutes_concentration: stats.minutesConcentration,
    minutes_concentration_prev: stats.minutesConcentrationPrev,
    taux_reussite: stats.tauxReussite,
    taux_reussite_prev: stats.tauxReussitePrev,
    problemes_reussis: stats.problemesReussis,
  }
}

// Le journal sert à l'affichage (carte « Erreur ») : son échec ne doit jamais interrompre l'envoi
async function journaliserEchecs(
  supabase: SupabaseClient,
  lignes: { rapport_id: string; referent_id: string; canal: 'whatsapp' | 'sms'; erreur: string }[],
  declenchement: 'manuel' | 'auto',
) {
  if (lignes.length === 0) return
  const { error } = await supabase
    .from('rapport_envoi_log')
    .insert(lignes.map((l) => ({ ...l, declenchement, statut: 'echec' })))
  if (error) console.error('[envoi hebdo] journal non enregistré', error.message)
}

export async function envoyerRapportsSemaine(
  supabase: SupabaseClient,
  lundiRapport: string,
  { declenchement, simulation = false }: { declenchement: 'manuel' | 'auto'; simulation?: boolean },
): Promise<IssueEnvoi> {
  if (enCours) return { occupe: true }
  enCours = true
  try {
    return await traiter(supabase, lundiRapport, declenchement, simulation)
  } finally {
    enCours = false
  }
}

async function traiter(
  supabase: SupabaseClient,
  lundiRapport: string,
  declenchement: 'manuel' | 'auto',
  simulation: boolean,
): Promise<IssueEnvoi> {
  // Agora coupé pour les élèves sans accès ou à l'abonnement résilié. Statut illisible → exception :
  // rien ne part, l'appelant renvoie une erreur et le prochain appel réessaiera.
  const motifBlocage = await chargerEligibiliteAgora(supabase)

  // Suiveurs actifs, regroupés par élève et triés par eleve_id (faux comptes exclus, comme dans l'Agora)
  const [{ data: liens, error: errLiens }, { data: faux }] = await Promise.all([
    supabase.from('referent_eleve').select('eleve_id, referent(id, prenom, nom, mode)').eq('actif', true).order('eleve_id'),
    supabase.rpc('get_fake_user_ids'),
  ])
  if (errLiens) throw new Error(`suiveurs illisibles : ${errLiens.message}`)
  const fauxIds = new Set(((faux ?? []) as { user_id: string }[]).map((f) => f.user_id))
  const parEleve = new Map<string, Suiveur[]>()
  const elevesBloques: Record<string, MotifBlocage> = {}
  for (const lien of (liens ?? []) as { eleve_id: string; referent: unknown }[]) {
    const motif = motifBlocage(lien.eleve_id)
    if (motif) {
      elevesBloques[lien.eleve_id] = motif
      continue
    }
    const r = (Array.isArray(lien.referent) ? lien.referent[0] : lien.referent) as
      | { id: string; prenom: string | null; nom: string | null; mode: string | null }
      | undefined
    if (!r || fauxIds.has(lien.eleve_id)) continue
    const nom = [r.prenom, r.nom].filter(Boolean).join(' ') || r.id
    parEleve.set(lien.eleve_id, [...(parEleve.get(lien.eleve_id) ?? []), { id: r.id, nom, mode: r.mode }])
  }
  const eleves = Array.from(parEleve).sort(([a], [b]) => a.localeCompare(b))

  const resultats: ResultatEnvoi[] = []
  let premier = true
  for (const [eleveId, suiveurs] of eleves) {
    if (!premier && !simulation) await pause(PAUSE_ENTRE_ELEVES_MS)
    premier = false

    // Connu dès que le rapport existe : permet de journaliser un échec survenu avant Twilio
    let rapportId: string | null = null
    let restants: Suiveur[] = suiveurs
    try {
      let { data: rapport } = await supabase
        .from('rapport_mensuel')
        .select(COLONNES_RAPPORT)
        .eq('eleve_id', eleveId)
        .eq('mois', lundiRapport)
        .maybeSingle()

      // Déjà traités : reçu (rapport_envoi), ou suiveur SMS déjà signalé dans le journal
      const deja = new Set<string>()
      const smsSignales = new Set<string>()
      if (rapport) {
        rapportId = rapport.id
        const [{ data: envoyes }, { data: logsSms }] = await Promise.all([
          supabase.from('rapport_envoi').select('referent_id').eq('rapport_id', rapport.id),
          supabase.from('rapport_envoi_log').select('referent_id').eq('rapport_id', rapport.id).eq('canal', 'sms'),
        ])
        for (const e of (envoyes ?? []) as { referent_id: string }[]) deja.add(e.referent_id)
        for (const l of (logsSms ?? []) as { referent_id: string }[]) smsSignales.add(l.referent_id)
      }
      for (const s of suiveurs) {
        if (deja.has(s.id)) resultats.push({ eleve: eleveId, referent: s.nom, statut: 'deja_envoye' })
      }
      restants = suiveurs.filter((s) => !deja.has(s.id))
      const whatsapp = restants.filter((s) => s.mode !== 'sms')
      const sms = restants.filter((s) => s.mode === 'sms')

      if (simulation) {
        for (const s of restants) {
          resultats.push({
            eleve: eleveId,
            referent: s.nom,
            statut: 'simulation',
            erreur: s.mode === 'sms' ? MOTIF_SMS : rapport?.image_path ? undefined : 'image à générer',
          })
        }
        continue
      }

      if (restants.length === 0) continue

      // Rapport de la semaine : créé s'il n'existe pas encore (aussi pour un élève aux seuls suiveurs
      // SMS, afin de pouvoir les signaler dans le journal)
      if (!rapport) {
        rapport = await creerRapport(supabase, eleveId, lundiRapport)
      } else if (whatsapp.length > 0 && deja.size === 0) {
        // Personne n'a encore reçu ce rapport : stats recalculées au moment de l'envoi. Un rapport
        // créé, ou une image générée, plus tôt depuis le panneau peut avoir des stats partielles.
        const stats = statsEnColonnes(await getUserStatsForWeek(eleveId, lundiRapport, supabase))
        const { error } = await supabase.from('rapport_mensuel').update(stats).eq('id', rapport.id)
        if (error) throw new Error(`mise à jour des stats impossible : ${error.message}`)
        rapport = { ...rapport, ...stats }
      }
      rapportId = rapport.id

      if (whatsapp.length > 0) {
        // Image : régénérée avec ces stats tant que personne n'a reçu le rapport, même si le panneau
        // en a déjà produit une. Dès qu'un suiveur l'a reçu (WhatsApp ou SMS), l'image existante est
        // gardée pour que tous reçoivent la même.
        if (deja.size === 0 || !rapport.image_path) {
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
          // Nom existant réutilisé (comme genererPng) : pas de fichier orphelin dans le bucket
          const chemin = rapport.image_path ?? `progression_${randomUUID().replace(/-/g, '').slice(0, 12)}.png`
          const { error: errUpload } = await supabase.storage
            .from('rapports')
            .upload(chemin, png, { upsert: true, contentType: 'image/png', cacheControl: '0' })
          if (errUpload) throw new Error(`upload de l'image impossible : ${errUpload.message}`)
          const { error: errImage } = await supabase.from('rapport_mensuel').update({ image_path: chemin }).eq('id', rapport.id)
          if (errImage) throw new Error(`enregistrement de l'image impossible : ${errImage.message}`)
          rapport = { ...rapport, image_path: chemin }
        }
      }

      // Suiveurs SMS : signalés une seule fois par rapport (la carte passe en « Erreur »)
      const idRapport = rapport.id
      await journaliserEchecs(
        supabase,
        sms
          .filter((s) => !smsSignales.has(s.id))
          .map((s) => ({ rapport_id: idRapport, referent_id: s.id, canal: 'sms' as const, erreur: MOTIF_SMS })),
        declenchement,
      )
      for (const s of sms) resultats.push({ eleve: eleveId, referent: s.nom, statut: 'sms_saute', erreur: MOTIF_SMS })

      // Envoi à chaque suiveur WhatsApp restant ; un échec (journalisé par envoyerRapportWhatsApp)
      // n'empêche pas les suivants
      for (const s of whatsapp) {
        try {
          const res = await envoyerRapportWhatsApp(supabase, idRapport, s.id, declenchement)
          resultats.push({ eleve: eleveId, referent: s.nom, statut: res.ok ? 'succes' : 'echec', erreur: res.ok ? undefined : res.erreur })
        } catch (e) {
          resultats.push({ eleve: eleveId, referent: s.nom, statut: 'echec', erreur: (e as Error).message })
        }
      }
    } catch (e) {
      // Échec avant Twilio (stats, image, upload) : journalisé pour chaque suiveur WhatsApp restant
      // dès que le rapport existe, pour que la carte passe en « Erreur » ; l'élève suivant est traité.
      const erreur = (e as Error).message
      console.error('[envoi hebdo] élève', eleveId, erreur)
      const whatsapp = restants.filter((s) => s.mode !== 'sms')
      if (rapportId) {
        await journaliserEchecs(
          supabase,
          whatsapp.map((s) => ({ rapport_id: rapportId!, referent_id: s.id, canal: 'whatsapp' as const, erreur: `Avant l'envoi : ${erreur}` })),
          declenchement,
        )
      }
      for (const s of whatsapp) resultats.push({ eleve: eleveId, referent: s.nom, statut: 'echec', erreur })
    }
  }

  const bilan: BilanEnvoi = {
    succes: resultats.filter((r) => r.statut === 'succes').length,
    echecs: resultats.filter((r) => r.statut === 'echec').length,
    dejaEnvoyes: resultats.filter((r) => r.statut === 'deja_envoye').length,
    smsSautes: resultats.filter((r) => r.statut === 'sms_saute').length,
    elevesBloques: Object.keys(elevesBloques).length,
  }
  return { occupe: false, resultats, bilan, elevesBloques }
}

// Rapport de la semaine : mêmes champs que celui créé par l'Agora
async function creerRapport(supabase: SupabaseClient, eleveId: string, lundiRapport: string) {
  const stats = statsEnColonnes(await getUserStatsForWeek(eleveId, lundiRapport, supabase))
  const { data: cree, error } = await supabase
    .from('rapport_mensuel')
    .insert({ eleve_id: eleveId, mois: lundiRapport, ...stats })
    .select(COLONNES_RAPPORT)
    .single()
  if (error || !cree) throw new Error(`création du rapport impossible : ${error?.message}`)
  return cree
}
