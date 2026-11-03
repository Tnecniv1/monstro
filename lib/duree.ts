// Durée de travail lisible, à partir d'un nombre de minutes.
// Sans dépendance : réutilisable telle quelle côté mobile.
//   45  → « 45 min »
//   120 → « 2 h »
//   214 → « 3 h 34 »
//   185 → « 3 h 05 »
export function formatDuree(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const heures = Math.floor(total / 60)
  const reste = total % 60
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`
}
