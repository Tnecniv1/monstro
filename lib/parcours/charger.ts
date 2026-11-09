import type { createClient } from '@/lib/supabase/server'
import { classerExercice, cleExercice, etapesDeLEleve, type EtapeProgression, type EtatsExercices } from './progression'
import type { FaitDate, FeuilleChaotique } from './accompagnement'

type Client = ReturnType<typeof createClient>

export type EtapeAccueil = EtapeProgression & {
  id: string
  type: 'feuille' | 'examen'
  libelle: string | null
  titre: string | null
}

export type ParcoursAccueil = {
  nom: string
  dateObjectif: string | null
  // Étapes qui concernent l'élève (règle B appliquée), triées par ordre.
  etapes: EtapeAccueil[]
  // Étape de départ du test de positionnement (règle A) ; null : début.
  etapeDepartId: string | null
  // Exercices faits, rattrapés et en échec (règles dans progression.ts).
  exercices: EtatsExercices
  // Feuilles chaotiques du parcours (accompagnement.ts), triées par ordre.
  chaotiques: ChaotiqueAccueil[]
  // Entraînements faits (observation succes, echec ou corrige) avec leur
  // date de création : compteurs P(f) et A(f) depuis la plus récente des
  // dates d'assignation et d'ajout de la feuille chaotique.
  faitsDates: FaitDate[]
  // parcours_eleve.created_at
  assigneLe: string
  // Un entraînement ou une correction est en cours : on ne peut pas en commencer un autre.
  activiteEnCours: boolean
}

export type ChaotiqueAccueil = FeuilleChaotique & { titre: string | null }

type LigneChaotique = {
  id: string
  feuille_id: string
  rythme: number
  exo_debut: number | null
  exo_fin: number | null
  ordre: number
  created_at: string
  feuille: { titre: string; volume: number } | null
}

type LigneEtape = {
  id: string
  ordre: number
  created_at: string
  type: 'feuille' | 'examen'
  feuille_id: string | null
  exo_debut: number | null
  exo_fin: number | null
  libelle: string | null
  feuille: { titre: string; volume: number } | null
}

type LigneEntrainement = {
  feuille_id: string
  ref_exo: number
  statut: string
  date_creation: string | null
  termine_at: string | null
  // Relation un-à-un : Supabase renvoie un objet ou null (tableau par prudence).
  observation: { etat: string | null } | { etat: string | null }[] | null
  correction_tentative: { statut: string; date_creation: string }[] | null
}


// Parcours assigné à l'élève (parcours_eleve), avec ses étapes et ses
// exercices faits. null si l'élève n'a pas de parcours : l'accueil actuel
// s'affiche alors sans changement.
export async function chargerParcoursEleve(supabase: Client, userId: string): Promise<ParcoursAccueil | null> {
  const { data: assignation, error } = await supabase
    .from('parcours_eleve')
    .select('parcours_id, date_objectif, etape_depart_id, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) console.error('[accueil] parcours_eleve', error)
  if (!assignation) return null

  const [
    { data: parcours, error: errParcours },
    { data: etapes, error: errEtapes },
    { data: entrainements, error: errEnt },
    { data: accompagnements, error: errAcc },
  ] = await Promise.all([
    supabase.from('parcours').select('nom').eq('id', assignation.parcours_id).maybeSingle(),
    supabase
      .from('parcours_etape')
      .select('id, ordre, created_at, type, feuille_id, exo_debut, exo_fin, libelle, feuille:feuille_entrainement ( titre, volume )')
      .eq('parcours_id', assignation.parcours_id)
      .order('ordre'),
    supabase
      .from('entrainement')
      .select('feuille_id, ref_exo, statut, date_creation, termine_at, observation ( etat ), correction_tentative ( statut, date_creation )')
      .eq('user_id', userId),
    supabase
      .from('parcours_accompagnement')
      .select('id, feuille_id, rythme, exo_debut, exo_fin, ordre, created_at, feuille:feuille_entrainement ( titre, volume )')
      .eq('parcours_id', assignation.parcours_id)
      .order('ordre'),
  ])
  if (errParcours) console.error('[accueil] parcours', errParcours)
  if (errEtapes) console.error('[accueil] parcours_etape', errEtapes)
  if (errEnt) console.error('[accueil] entrainement', errEnt)
  // Sans les feuilles chaotiques, le parcours fonctionne comme avant.
  if (errAcc) console.error('[accueil] parcours_accompagnement', errAcc)
  if (!parcours) return null

  let activiteEnCours = false
  // Même règle que /entrainement : une correction en_cours d'un jour passé est expirée.
  const aujourdhui = new Date().toISOString().slice(0, 10)
  // Du plus ancien au plus récent, pour repérer un echec suivi d'un succes.
  const lignes = ((entrainements ?? []) as unknown as LigneEntrainement[])
    .slice()
    .sort((a, b) => (a.date_creation ?? a.termine_at ?? '').localeCompare(b.date_creation ?? b.termine_at ?? ''))
  // États des observations de chaque exercice, dans l'ordre chronologique.
  const etatsParExercice = new Map<string, (string | null)[]>()
  const faitsDates: FaitDate[] = []
  for (const e of lignes) {
    const obs = Array.isArray(e.observation) ? e.observation : e.observation ? [e.observation] : []
    const cle = cleExercice(e.feuille_id, e.ref_exo)
    etatsParExercice.set(cle, [...(etatsParExercice.get(cle) ?? []), ...obs.map((o) => o.etat)])
    if (obs.some((o) => o.etat === 'succes' || o.etat === 'echec' || o.etat === 'corrige')) {
      faitsDates.push({ feuille_id: e.feuille_id, ref_exo: e.ref_exo, date: e.date_creation ?? e.termine_at })
    }
    if (e.statut === 'en_cours') activiteEnCours = true
    if (e.correction_tentative?.some((c) => c.statut === 'en_cours' && c.date_creation >= aujourdhui)) activiteEnCours = true
  }

  const exercices: EtatsExercices = { faits: new Set(), rattrapes: new Set(), echecs: new Set() }
  etatsParExercice.forEach((etats, cle) => {
    const { fait, rattrape, echec } = classerExercice(etats)
    if (fait) exercices.faits.add(cle)
    if (rattrape) exercices.rattrapes.add(cle)
    if (echec) exercices.echecs.add(cle)
  })

  const toutes: EtapeAccueil[] = ((etapes ?? []) as unknown as LigneEtape[]).map((e) => ({
    id: e.id,
    ordre: e.ordre,
    created_at: e.created_at,
    type: e.type,
    libelle: e.libelle,
    feuille_id: e.feuille_id,
    exo_debut: e.exo_debut,
    exo_fin: e.exo_fin,
    titre: e.feuille?.titre ?? null,
    volume: e.feuille?.volume ?? null,
  }))
  const etapeDepartId: string | null = assignation.etape_depart_id ?? null

  return {
    nom: parcours.nom,
    dateObjectif: assignation.date_objectif,
    etapes: etapesDeLEleve(toutes, exercices, { etapeDepartId, assigneLe: assignation.created_at }),
    etapeDepartId,
    exercices,
    chaotiques: ((accompagnements ?? []) as unknown as LigneChaotique[]).map((c) => ({
      id: c.id,
      feuille_id: c.feuille_id,
      rythme: c.rythme,
      exo_debut: c.exo_debut,
      exo_fin: c.exo_fin,
      ordre: c.ordre,
      ajouteeLe: c.created_at,
      volume: c.feuille?.volume ?? null,
      titre: c.feuille?.titre ?? null,
    })),
    faitsDates,
    assigneLe: assignation.created_at,
    activiteEnCours,
  }
}
