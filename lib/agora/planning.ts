// Planification de l'envoi automatique des rapports hebdomadaires (heure de Paris).

export const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

// Créneaux proposés : de 06:00 à 22:00 par demi-heure. L'envoi reste possible de l'heure réglée
// jusqu'à minuit le même jour (reprise après un échec) : pas d'ambiguïté de jour ni de semaine.
export const HEURES_ENVOI = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

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
 * Lundi de la dernière semaine terminée à l'heure de Paris : le dimanche, la semaine qui
 * s'achève ; les autres jours, la semaine précédente. Semaine du rapport envoyé par le cron et
 * semaine par défaut de l'Agora.
 */
export function lundiDerniereSemaine(date = new Date()): string {
  const now = maintenantParis(date)
  const lundiCourant = decalerJours(now.date, -(now.jourIso - 1))
  return now.jourIso === 7 ? lundiCourant : decalerJours(lundiCourant, -7)
}

/**
 * Le moment `maintenant` est-il dans le créneau configuré (jour réglé, de l'heure réglée à
 * minuit) ? Renvoie aussi le lundi de la semaine dont le rapport est envoyé.
 */
export function evaluerCreneau(jourSemaine: number, heure: string, date = new Date()) {
  const now = maintenantParis(date)
  const dansLeCreneau = now.jourIso === jourSemaine && now.minutes >= heureEnMinutes(heure)
  return { dansLeCreneau, lundiRapport: lundiDerniereSemaine(date), maintenant: now }
}
