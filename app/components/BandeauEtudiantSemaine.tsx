import Link from 'next/link'
import Avatar from './Avatar'
import { formatDuree } from '@/lib/duree'
import type { Laureat } from '@/lib/classement'

// « A », « A et B », « A, B et C ».
function listePseudos(pseudos: string[]): string {
  if (pseudos.length <= 1) return pseudos[0] ?? ''
  return `${pseudos.slice(0, -1).join(', ')} et ${pseudos[pseudos.length - 1]}`
}

// Bandeau d'accueil vers /classement : lauréat(s) de la semaine précédente.
// Plusieurs lauréats : avatar du premier seulement, et le temps de travail
// n'est affiché que s'il est le même pour tous.
export default function BandeauEtudiantSemaine({ laureats }: { laureats: Laureat[] }) {
  const premier = laureats[0]
  const plusieurs = laureats.length > 1
  const pseudos = listePseudos(laureats.map((l) => l.pseudo ?? '—'))
  const memeDuree = new Set(laureats.map((l) => l.minutes)).size === 1
  const ligne = memeDuree ? `${pseudos} · ${formatDuree(premier.minutes)} de travail` : pseudos

  return (
    <Link
      href="/classement"
      className="flex w-full max-w-sm min-h-[44px] items-center gap-3 rounded-[14px] bg-accent-soft px-[18px] py-[14px]"
    >
      <Avatar
        url={premier.avatar_url}
        pseudo={premier.pseudo ?? '—'}
        size={44}
        className="shrink-0 ring-2 ring-accent"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-[0.04em] text-accent">
          {plusieurs ? 'ÉTUDIANTS DE LA SEMAINE' : 'ÉTUDIANT DE LA SEMAINE'}
        </p>
        <p className="truncate text-base font-bold text-text-primary">{ligne}</p>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-accent"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  )
}
