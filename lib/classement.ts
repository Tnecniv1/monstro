// Classement hebdomadaire / global et Étudiant de la semaine : types des RPC
// (classement_semaine, classement_global, etudiant_de_la_semaine) et petits
// utilitaires d'affichage partagés entre /classement et l'accueil.

export interface LigneClassement {
  rang: number
  user_id: string
  pseudo: string | null
  avatar_url: string | null
  pixels: number
  jours_actifs: number
}

export interface Laureat {
  user_id: string
  pseudo: string | null
  avatar_url: string | null
  minutes: number
  jours_actifs: number
  pixels: number
  semaine_debut: string // date ISO (lundi), AAAA-MM-JJ
}

// Données d'une vue, préparées côté serveur.
export interface VueClassement {
  podium: LigneClassement[]
  liste: LigneClassement[]
  moi: LigneClassement | null
  message: string | null // carte « toi » : écart avec le rang précédent
}

export type NomVue = 'semaine' | 'global'

// Semaine en cours en heure de Paris (dates ISO lundi et dimanche).
export interface SemaineParis {
  debut: string
  fin: string
  joursRestants: number // 0 le dimanche
}

// « 1er », « 2e », « 3e »…
export function ordinal(rang: number): string {
  return rang === 1 ? '1er' : `${rang}e`
}

const FUSEAU = 'Europe/Paris'
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

// Date du jour à Paris, AAAA-MM-JJ.
function dateParis(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

// Calcul sur des dates civiles (minuit UTC) : pas d'effet des changements d'heure.
function ajouterJours(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

export function semaineParis(instant: Date = new Date()): SemaineParis {
  const jour = dateParis(instant)
  const depuisLundi = (new Date(`${jour}T00:00:00Z`).getUTCDay() + 6) % 7
  return {
    debut: ajouterJours(jour, -depuisLundi),
    fin: ajouterJours(jour, 6 - depuisLundi),
    joursRestants: 6 - depuisLundi,
  }
}

function jourMois(iso: string): { jour: string; mois: string } {
  const [, m, j] = iso.split('-').map(Number)
  return { jour: j === 1 ? '1er' : String(j), mois: MOIS[m - 1] }
}

// « du 2 au 8 novembre », « du 26 octobre au 1er novembre ».
export function periodeSemaine(debut: string): string {
  const a = jourMois(debut)
  const b = jourMois(ajouterJours(debut, 6))
  return a.mois === b.mois
    ? `du ${a.jour} au ${b.jour} ${b.mois}`
    : `du ${a.jour} ${a.mois} au ${b.jour} ${b.mois}`
}
