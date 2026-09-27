'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PAGES = [
  { href: '/', label: 'Maison' },
  { href: '/voyage', label: 'Voyage' },
  { href: '/problemes', label: 'Problèmes' },
  { href: '/philosophie', label: 'Philosophie' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  // Une section reste active sur ses sous-pages (ex. futur /philosophie/[slug])
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function MaisonNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Sections" className="flex justify-center">
      {/* Sur petit écran : une seule ligne, défilement horizontal si besoin */}
      <div className="max-w-full overflow-x-auto">
        <ul className="flex whitespace-nowrap rounded-full border border-gray-200 bg-white p-0.5 text-[13px]">
          {PAGES.map(({ href, label }) => {
            const active = isActive(pathname, href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-full px-2.5 sm:px-3 py-1 font-medium transition-colors ${
                    active ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
