// Formatage relatif compact ("il y a 5 min") avec repli sur une date absolue
// au-delà d'une semaine — pas de dépendance externe (pas de date-fns dans le projet).
export function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diffSec < 60) return "à l'instant"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffJ = Math.floor(diffH / 24)
  if (diffJ < 7) return `il y a ${diffJ} j`

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Jours calendaires écoulés depuis une date 'YYYY-MM-DD', comptés à l'heure de
// Paris : "aujourd'hui", "hier", "il y a N j", ou "jamais" si null.
export function formatJoursDepuis(date: string | null): string {
  if (!date) return 'jamais'
  const aujourdhui = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const diffJ = Math.round((Date.parse(aujourdhui) - Date.parse(date)) / 86_400_000)

  if (diffJ <= 0) return "aujourd'hui"
  if (diffJ === 1) return 'hier'
  return `il y a ${diffJ} j`
}

// Jour calendaire 'YYYY-MM-DD' d'un horodatage, à l'heure de Paris — clé de
// regroupement des messages par jour.
export function jourParis(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

// Heure "HH:mm" à l'heure de Paris (bulles de conversation).
export function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
}

// Séparateur de jour : "Aujourd'hui", "Hier", puis la date ("3 octobre 2026").
export function libelleJour(jour: string): string {
  const aujourdhui = jourParis(new Date().toISOString())
  const diffJ = Math.round((Date.parse(aujourdhui) - Date.parse(jour)) / 86_400_000)
  if (diffJ === 0) return "Aujourd'hui"
  if (diffJ === 1) return 'Hier'
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
