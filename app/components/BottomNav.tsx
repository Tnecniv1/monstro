'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/',
    label: 'Accueil',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: '/entrainement',
    label: 'Entraînements',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M7 9h10M7 13h10M7 17h6" />
      </svg>
    ),
  },
  {
    href: '/bibliotheque',
    label: 'Bibliothèque',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5a2 2 0 0 1 2-2h13" />
        <path d="M4 19a2 2 0 0 0 2 2h13V7H6a2 2 0 0 0-2 2v10z" />
        <path d="M9 10h6M9 14h4" />
      </svg>
    ),
  },
  {
    href: '/parcours',
    label: 'Parcours',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 17 7 11 11 14 15 8 21 15" />
      </svg>
    ),
  },
  {
    href: '/classement',
    label: 'Classement',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-3" />
        <path d="M8 21V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12" />
        <path d="M8 21h8" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* Mobile / Tablette */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 w-full bg-white z-50"
        style={{ borderTop: '0.5px solid #e5e7eb' }}
      >
        <div className="flex">
          {tabs.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 text-xs font-medium transition-colors ${
                isActive(href) ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop */}
      <nav
        className="hidden lg:block fixed top-0 w-full bg-white z-50"
        style={{ borderBottom: '0.5px solid #e5e7eb' }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-medium text-gray-900">Monstro</span>
          <div className="flex items-center gap-8">
            {tabs.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm transition-colors ${
                  isActive(href)
                    ? 'text-black font-medium'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
