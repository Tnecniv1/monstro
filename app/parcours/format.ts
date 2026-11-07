// Formats partagés par les tableaux de /parcours (Historique et Parcours).

export function formatTemps(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`
}

export function couleurTaux(taux: number) {
  if (taux >= 80) return 'text-success'
  if (taux >= 50) return 'text-warning'
  return 'text-danger'
}
