// Pastille rouge avec un nombre (« 9+ » au-delà de 9), rien à 0 — onglet
// Questions du forum et carte Forum de l'accueil. Le positionnement est
// laissé à l'appelant (className).
export default function PastilleCompteur({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ${className}`}
    >
      {count > 9 ? '9+' : count}
      <span className="sr-only"> en attente</span>
    </span>
  )
}

// Point rouge sans nombre : une question en attente (liste du forum, carte
// « Ton ticket en cours »).
export function PointAttente() {
  return (
    <span className="h-2 w-2 shrink-0 rounded-full bg-danger">
      <span className="sr-only">en attente</span>
    </span>
  )
}
