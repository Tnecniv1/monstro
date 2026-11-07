'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

// Avatar + pseudo de l'en-tête de l'accueil. Élève : lien direct vers
// /profil. Admin : petit menu (Profil, Admin), fermé au clic extérieur et
// avec Échap.
export default function MenuProfil({
  pseudo,
  avatarUrl,
  isAdmin,
}: {
  pseudo: string
  avatarUrl: string | null
  isAdmin: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const racine = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function clic(e: MouseEvent) {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false)
    }
    function touche(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOuvert(false)
        bouton.current?.focus()
      }
    }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert])

  const identite = (
    <>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={28}
          height={28}
          className="rounded-full object-cover"
          style={{ width: 28, height: 28 }}
        />
      ) : (
        <span
          aria-hidden
          className="flex items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-text-secondary"
          style={{ width: 28, height: 28 }}
        >
          {pseudo ? pseudo[0].toUpperCase() : '?'}
        </span>
      )}
      <span className="font-semibold text-text-primary">{pseudo}</span>
    </>
  )

  if (!isAdmin) {
    return (
      <Link href="/profil" className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80">
        {identite}
      </Link>
    )
  }

  const liens = [
    { href: '/profil', libelle: 'Profil' },
    { href: '/admin', libelle: 'Admin' },
  ]

  return (
    <div ref={racine} className="relative">
      <button
        ref={bouton}
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80"
      >
        {identite}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`text-text-muted transition-transform ${ouvert ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {ouvert && (
        <ul
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {liens.map((l) => (
            <li key={l.href} role="none">
              <Link
                href={l.href}
                role="menuitem"
                onClick={() => setOuvert(false)}
                className="block px-4 py-2.5 text-sm text-text-primary hover:bg-surface-2"
              >
                {l.libelle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
