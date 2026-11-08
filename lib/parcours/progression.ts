// Progression d'un élève dans son parcours (objectif). Fonction pure, sans
// Supabase ni React : (étapes, état des exercices) → étape en cours, prochaine
// action, par étape : exercices faits, rattrapés et en échec ; parcours terminé.
//
// Une étape examen se traite comme une feuille : ses exercices sont les sujets.
//
// Règle A (test de positionnement) : les étapes d'ordre strictement inférieur
// à l'étape de départ sont acquises par le test ; elles ne sont jamais l'étape
// en cours. Départ introuvable (supprimé) : comportement normal.
// Règle B (étapes ajoutées après l'assignation) : voir etapesDeLEleve.

export type EtapeProgression = {
  id: string
  ordre: number
  // Date de création de l'étape (ISO) : sert à la règle B.
  created_at: string
  feuille_id: string | null
  exo_debut: number | null
  exo_fin: number | null
  // Nombre d'exercices de la feuille (feuille_entrainement.volume).
  volume: number | null
}

export type Progression = {
  // Index (dans le tableau des étapes) de la première étape qui contient un
  // exercice non fait ; null si aucune (parcours terminé ou sans étape).
  etapeCouranteIndex: number | null
  // Premier ref_exo non fait de l'étape en cours ; null si terminé.
  prochainExo: number | null
  // Par étape, dans sa plage : exercices faits, rattrapés et en échec.
  faitsParEtape: number[]
  rattrapesParEtape: number[]
  echecsParEtape: number[]
  // Par étape : acquise par le test de positionnement (règle A).
  acquisParTest: boolean[]
  // Vrai si le parcours a au moins une étape et que tout est fait (les
  // étapes acquises par le test comptent comme faites).
  termine: boolean
}

// État des exercices d'un élève, par clé cleExercice.
export type EtatsExercices = {
  // Au moins une observation succes, echec ou corrige.
  faits: Set<string>
  // Au moins une observation corrige, ou dernier echec suivi d'un succes sur
  // un entraînement ultérieur du même exercice.
  rattrapes: Set<string>
  // Aucune observation corrige, et dernier echec suivi d'aucun succes.
  echecs: Set<string>
}

// Classe un exercice d'après les états de ses observations, du plus ancien
// entraînement au plus récent (null : entraînement en cours, pas fait).
export function classerExercice(etats: (string | null)[]): { fait: boolean; rattrape: boolean; echec: boolean } {
  const fait = etats.some((e) => e === 'succes' || e === 'echec' || e === 'corrige')
  // Une observation corrige : rattrapé. Sinon, on regarde le dernier echec :
  // suivi d'un succes → rattrapé, sinon → echec (même avec un succes avant).
  const dernierEchec = etats.lastIndexOf('echec')
  const corrige = etats.includes('corrige')
  const succesApres = dernierEchec >= 0 && etats.slice(dernierEchec + 1).includes('succes')
  const rattrape = corrige || succesApres
  const echec = !corrige && dernierEchec >= 0 && !succesApres
  return { fait, rattrape, echec }
}

// Clé d'un exercice dans les ensembles d'EtatsExercices.
export function cleExercice(feuilleId: string, refExo: number): string {
  return `${feuilleId}:${refExo}`
}

// Plage d'exercices d'une étape : exo_debut ?? 1 à exo_fin ?? volume.
// Vide (fin < debut) si la feuille manque ou n'a pas d'exercice.
export function plageEtape(e: EtapeProgression): { debut: number; fin: number } {
  if (!e.feuille_id) return { debut: 1, fin: 0 }
  return { debut: e.exo_debut ?? 1, fin: e.exo_fin ?? e.volume ?? 0 }
}

// Étapes acquises par le test : ordre strictement inférieur à celui de
// l'étape de départ. Tout faux si le départ est absent ou introuvable.
function acquises(etapes: EtapeProgression[], etapeDepartId: string | null): boolean[] {
  const depart = etapeDepartId ? etapes.find((e) => e.id === etapeDepartId) : undefined
  return etapes.map((e) => (depart ? e.ordre < depart.ordre : false))
}

export function calculerProgression(
  etapes: EtapeProgression[],
  exercices: EtatsExercices,
  etapeDepartId: string | null = null
): Progression {
  let etapeCouranteIndex: number | null = null
  let prochainExo: number | null = null
  const faitsParEtape: number[] = []
  const rattrapesParEtape: number[] = []
  const echecsParEtape: number[] = []
  const acquisParTest = acquises(etapes, etapeDepartId)

  etapes.forEach((e, i) => {
    const acquise = acquisParTest[i]
    const { debut, fin } = plageEtape(e)
    let faits = 0
    let rattrapes = 0
    let echecs = 0
    for (let n = debut; n <= fin; n++) {
      const cle = cleExercice(e.feuille_id!, n)
      if (exercices.rattrapes.has(cle)) rattrapes++
      if (exercices.echecs.has(cle)) echecs++
      if (exercices.faits.has(cle)) {
        faits++
      } else if (etapeCouranteIndex === null && !acquise) {
        etapeCouranteIndex = i
        prochainExo = n
      }
    }
    faitsParEtape.push(faits)
    rattrapesParEtape.push(rattrapes)
    echecsParEtape.push(echecs)
  })

  return {
    etapeCouranteIndex,
    prochainExo,
    faitsParEtape,
    rattrapesParEtape,
    echecsParEtape,
    acquisParTest,
    termine: etapes.length > 0 && etapeCouranteIndex === null,
  }
}

// Instant (ms depuis 1970, UTC) d'un timestamptz renvoyé par Supabase, lu à
// la main : Date.parse de Hermes (app mobile) ne garantit pas les fractions
// de seconde à plus de 3 chiffres. Accepte « T » ou espace, secondes et
// fraction facultatives (tronquée à la milliseconde), fuseau Z, ±hh, ±hhmm
// ou ±hh:mm (UTC si absent). NaN si le format n'est pas reconnu.
// Exemples :
//   lireDate('2026-11-06T17:08:42.707561+00:00') → 1793984922707 (6 décimales)
//   lireDate('2026-11-06T18:08:42.707+01:00')    → 1793984922707 (même instant)
//   lireDate('2026-11-06 17:08:42Z')             → 1793984922000
//   lireDate('06/11/2026')                       → NaN
export function lireDate(texte: string | null | undefined): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i.exec(
    (texte ?? '').trim()
  )
  if (!m) return NaN
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0), ms)
  let decalageMin = 0
  const fuseau = m[8]
  if (fuseau && fuseau.toUpperCase() !== 'Z') {
    const signe = fuseau[0] === '-' ? -1 : 1
    const chiffres = fuseau.slice(1).replace(':', '')
    decalageMin = signe * (Number(chiffres.slice(0, 2)) * 60 + Number(chiffres.slice(2, 4) || 0))
  }
  return utc - decalageMin * 60000
}

// Règle B : étapes du parcours qui concernent l'élève. Une étape créée après
// l'assignation (created_at postérieur) est « ajoutée après coup ». P0 =
// étape en cours calculée sans ces étapes (règle A comprise). Les étapes
// ajoutées après coup d'ordre inférieur à P0 sont retirées ; si P0 n'existe
// pas (tout est fini), aucune ne l'est. L'étape de départ n'est jamais retirée.
// Les étapes doivent être triées par ordre.
export function etapesDeLEleve<E extends EtapeProgression>(
  etapes: E[],
  exercices: EtatsExercices,
  assignation: { etapeDepartId: string | null; assigneLe: string }
): E[] {
  const assigneLe = lireDate(assignation.assigneLe)
  const apresCoup = (e: E) => lireDate(e.created_at) > assigneLe
  if (isNaN(assigneLe) || !etapes.some(apresCoup)) return etapes

  const initiales = etapes.filter((e) => !apresCoup(e) || e.id === assignation.etapeDepartId)
  const { etapeCouranteIndex } = calculerProgression(initiales, exercices, assignation.etapeDepartId)
  if (etapeCouranteIndex === null) return etapes
  const ordreP0 = initiales[etapeCouranteIndex].ordre

  return etapes.filter((e) => !apresCoup(e) || e.id === assignation.etapeDepartId || e.ordre >= ordreP0)
}

// Date du jour à Paris, 'AAAA-MM-JJ'. Assemblée à partir des champs de
// formatToParts plutôt que du format « en-CA » : l'ordre des champs de ce
// format n'est pas garanti par l'Intl de Hermes (app mobile). Fichier
// identique côté web et côté mobile : pas d'import, fonction locale.
function dateParis(instant: Date): string {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const valeur = (type: string) => parties.find((p) => p.type === type)?.value ?? ''
  return `${valeur('year')}-${valeur('month')}-${valeur('day')}`
}

// Jours calendaires entre aujourd'hui à Paris et dateObjectif ('YYYY-MM-DD').
// Positif avant l'examen, 0 le jour même, négatif après.
export function joursRestants(dateObjectif: string, maintenant: Date = new Date()): number | null {
  const cible = Date.parse(`${dateObjectif}T00:00:00Z`)
  if (isNaN(cible)) return null
  const aujourdhui = dateParis(maintenant)
  return Math.round((cible - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86400000)
}
