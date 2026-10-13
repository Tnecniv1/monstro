// Calculs de semaine de l'onglet Équipe, sur des jours calendaires 'YYYY-MM-DD'
// (heure de Paris). Arithmétique en UTC : pas de piège de fuseau ni d'heure d'été.
import { jourParis } from './relativeTime'

const JOUR_MS = 86_400_000

function enDate(jour: string): Date {
  return new Date(`${jour}T00:00:00Z`)
}

function nomDuJour(jour: string): string {
  return enDate(jour).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long' })
}

export function aujourdhuiParis(): string {
  return jourParis(new Date().toISOString())
}

export function ajouterJours(jour: string, n: number): string {
  return new Date(enDate(jour).getTime() + n * JOUR_MS).toISOString().slice(0, 10)
}

// Lundi de la semaine qui contient `jour`.
export function lundiDe(jour: string): string {
  return ajouterJours(jour, -((enDate(jour).getUTCDay() + 6) % 7))
}

// "MERCREDI 14"
export function libelleJourLong(jour: string): string {
  return `${nomDuJour(jour).toUpperCase()} ${enDate(jour).getUTCDate()}`
}

// Jour d'une session par rapport à aujourd'hui : "ce soir" (à partir de 17 h),
// "aujourd'hui", "demain", sinon le jour de la semaine ("mercredi").
export function libelleQuand(jour: string, heure: string): string {
  const aujourdhui = aujourdhuiParis()
  if (jour === aujourdhui) return heure >= '17:00' ? 'ce soir' : "aujourd'hui"
  if (jour === ajouterJours(aujourdhui, 1)) return 'demain'
  return nomDuJour(jour)
}

// "du 12 au 16 octobre" ou "du 28 septembre au 2 octobre" (de `debut` à `fin` inclus)
export function libellePeriode(debut: string, fin: string): string {
  const numero = (jour: string) => {
    const n = enDate(jour).getUTCDate()
    return n === 1 ? '1er' : String(n)
  }
  const mois = (jour: string) => enDate(jour).toLocaleDateString('fr-FR', { timeZone: 'UTC', month: 'long' })
  const depuis = mois(debut) === mois(fin) ? numero(debut) : `${numero(debut)} ${mois(debut)}`
  return `du ${depuis} au ${numero(fin)} ${mois(fin)}`
}
