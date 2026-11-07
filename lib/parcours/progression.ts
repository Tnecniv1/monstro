// Progression d'un élève dans son parcours (objectif). Fonction pure, sans
// Supabase ni React : (étapes, état des exercices) → étape en cours, prochaine
// action, par étape : exercices faits, rattrapés et en échec ; parcours terminé.
//
// Une étape examen se traite comme une feuille : ses exercices sont les sujets.

export type EtapeProgression = {
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
  // Vrai si le parcours a au moins une étape et que tout est fait.
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

export function calculerProgression(etapes: EtapeProgression[], exercices: EtatsExercices): Progression {
  let etapeCouranteIndex: number | null = null
  let prochainExo: number | null = null
  const faitsParEtape: number[] = []
  const rattrapesParEtape: number[] = []
  const echecsParEtape: number[] = []

  etapes.forEach((e, i) => {
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
      } else if (etapeCouranteIndex === null) {
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
    termine: etapes.length > 0 && etapeCouranteIndex === null,
  }
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
