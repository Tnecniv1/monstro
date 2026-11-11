import type { createClient } from '@/lib/supabase/server'

type Client = ReturnType<typeof createClient>

// Exercice que l'élève est en train de faire : entraînement au statut
// en_cours, ou correction en cours (correction_tentative en_cours créée
// aujourd'hui, même règle que /entrainement et lib/parcours/charger.ts). Si les
// deux existent, le plus récent. Sert à l'énoncé flottant et à la carte
// « Prochaine action » de l'accueil.
// Documents : énoncé = feuille_entrainement.pdf_url, correction = table
// correction (pdf_url), bucket privé pdfs, ouverts par getSignedPdfUrl.
export type ExerciceEnCours = {
  entrainementId: string
  feuilleId: string
  exo: number
  titre: string
  enonceUrl: string | null
  correctionUrl: string | null
  type: 'entrainement' | 'correction'
}

type LigneEntrainement = {
  id: string
  feuille_id: string
  ref_exo: number
  date_creation: string | null
  feuille_entrainement: {
    titre: string
    pdf_url: string | null
    correction: { pdf_url: string | null } | { pdf_url: string | null }[] | null
  } | null
}

const COLONNES =
  'id, feuille_id, ref_exo, date_creation, feuille_entrainement ( titre, pdf_url, correction ( pdf_url ) )'

function versExercice(e: LigneEntrainement, type: ExerciceEnCours['type']): ExerciceEnCours {
  const f = e.feuille_entrainement
  const correction = Array.isArray(f?.correction) ? f?.correction[0] ?? null : f?.correction ?? null
  return {
    entrainementId: e.id,
    feuilleId: e.feuille_id,
    exo: e.ref_exo,
    titre: f?.titre ?? 'Feuille',
    enonceUrl: f?.pdf_url ?? null,
    correctionUrl: correction?.pdf_url ?? null,
    type,
  }
}

export async function chargerExerciceEnCours(supabase: Client, userId: string): Promise<ExerciceEnCours | null> {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const [entrainement, tentative] = await Promise.all([
    supabase
      .from('entrainement')
      .select(COLONNES)
      .eq('user_id', userId)
      .eq('statut', 'en_cours')
      .order('date_creation', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('correction_tentative')
      .select(`date_creation, entrainement!inner ( ${COLONNES}, user_id )`)
      .eq('statut', 'en_cours')
      .gte('date_creation', aujourdhui)
      .eq('entrainement.user_id', userId)
      .order('date_creation', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (entrainement.error) console.error('[exercice en cours] entrainement', entrainement.error)
  if (tentative.error) console.error('[exercice en cours] correction_tentative', tentative.error)

  const enCours = (entrainement.data ?? null) as unknown as LigneEntrainement | null
  const t = (tentative.data ?? null) as unknown as { date_creation: string; entrainement: LigneEntrainement | null } | null
  const enCorrection = t?.entrainement ?? null

  if (enCours && enCorrection) {
    // Le plus récent : création de l'entraînement contre début de la correction.
    return (enCours.date_creation ?? '') >= t!.date_creation
      ? versExercice(enCours, 'entrainement')
      : versExercice(enCorrection, 'correction')
  }
  if (enCours) return versExercice(enCours, 'entrainement')
  if (enCorrection) return versExercice(enCorrection, 'correction')
  return null
}
