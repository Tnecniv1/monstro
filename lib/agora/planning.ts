// Planification de l'envoi automatique des rapports hebdomadaires (heure de Paris).

export const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

// Créneaux proposés : de 06:00 à 22:00 par demi-heure. La fenêtre de tolérance (±30 min)
// reste ainsi dans la même journée : pas d'ambiguïté de jour ni de semaine autour de minuit.
export const HEURES_ENVOI = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

export const TOLERANCE_MINUTES = 30

/** Jour ISO (1 = lundi … 7 = dimanche), date 'YYYY-MM-DD' et minutes depuis minuit, à Paris. */
export function maintenantParis(date = new Date()): { jourIso: number; date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  const jourIso = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1
  return {
    jourIso,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function decalerJours(iso: string, jours: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + jours))
  return date.toISOString().slice(0, 10)
}

/** 'HH:MM' ou 'HH:MM:SS' (colonne time) → minutes depuis minuit. */
export function heureEnMinutes(heure: string): number {
  const [h, m] = heure.split(':').map(Number)
  return h * 60 + m
}

/**
 * Le moment `maintenant` est-il dans le créneau configuré (même jour, ±30 min) ?
 * Renvoie aussi le lundi de la semaine en cours (clé d'idempotence) et celui de la semaine
 * précédente, dont le rapport est envoyé (même règle que la semaine par défaut de l'Agora).
 */
export function evaluerCreneau(jourSemaine: number, heure: string, date = new Date()) {
  const now = maintenantParis(date)
  const lundiCourant = decalerJours(now.date, -(now.jourIso - 1))
  const dansLeCreneau =
    now.jourIso === jourSemaine && Math.abs(now.minutes - heureEnMinutes(heure)) <= TOLERANCE_MINUTES
  return { dansLeCreneau, lundiCourant, lundiRapport: decalerJours(lundiCourant, -7), maintenant: now }
}
