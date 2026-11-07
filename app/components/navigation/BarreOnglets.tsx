'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PastilleCompteur from '../PastilleCompteur'
import { useForumAttente } from '../ForumAttenteProvider'

type Onglet = { href: string; libelle: string; icone: React.ReactNode }

function Icone({ d }: { d: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

const ONGLETS: Onglet[] = [
  { href: '/', libelle: 'Accueil', icone: <Icone d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  {
    href: '/parcours',
    libelle: 'Parcours',
    icone: <Icone d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" />,
  },
  { href: '/bibliotheque', libelle: 'Bibliothèque', icone: <Icone d="M4 4h6v16H4zM14 4l5 1-3 15-5-1z" /> },
  { href: '/forum', libelle: 'Forum', icone: <Icone d="M4 5h16v11H9l-5 4z" /> },
  {
    href: '/classement',
    libelle: 'Classement',
    icone: <Icone d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  },
]

function estActif(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Hauteur de la barre hors safe-area (padding bas du contenu : AvecBarreOnglets).
export const HAUTEUR_BARRE = 56

// Barre d'onglets fixée en bas des pages élève principales. Onglet actif selon
// le chemin (sous-pages comprises) ; /entrainement n'en a pas. Pastille des
// questions en attente sur Forum. Classement absent pour un élève confidentiel.
export default function BarreOnglets({ afficherClassement }: { afficherClassement: boolean }) {
  const pathname = usePathname()
  const { count } = useForumAttente()
  const onglets = afficherClassement ? ONGLETS : ONGLETS.filter((o) => o.href !== '/classement')

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-sm">
        {onglets.map((o) => {
          const actif = estActif(pathname, o.href)
          return (
            <li key={o.href} className="min-w-0 flex-1">
              <Link
                href={o.href}
                aria-current={actif ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight transition-colors ${
                  actif ? 'font-extrabold' : 'font-semibold'
                }`}
                style={{ minHeight: HAUTEUR_BARRE, color: actif ? '#6D28D9' : '#6B6D80' }}
              >
                <span className="relative">
                  {o.icone}
                  {o.href === '/forum' && <PastilleCompteur count={count} className="absolute -right-2.5 -top-1.5" />}
                </span>
                <span className="max-w-full truncate">{o.libelle}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
