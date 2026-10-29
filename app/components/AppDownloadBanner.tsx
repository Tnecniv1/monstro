'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { PUBLIC_PATHS, isVitrine } from '@/lib/access'

const APP_STORE_URL = 'https://apps.apple.com/app/id6768066030'
const DISMISS_KEY = 'monstro_app_banner_dismissed'

// Admin, et pages plein écran (lecture d'une feuille, missions) : pas de bandeau.
const SECTIONS_EXCLUES = ['/admin', '/viewer', '/mission']

type Plateforme = 'ios-safari' | 'ios-autre' | 'android' | 'ordinateur'

function detecterPlateforme(): Plateforme {
  const ua = navigator.userAgent
  // iPadOS 13+ se présente comme un Mac : on le reconnaît à l'écran tactile.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) {
    // Safari porte « Safari/ » ; les navigateurs intégrés aux apps (Instagram…)
    // non, et Apple n'y affiche pas son bandeau natif.
    return /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-safari' : 'ios-autre'
  }
  if (/Android/.test(ua)) return 'android'
  return 'ordinateur'
}

// Même découpage qu'OnboardingGate : '/' est la landing pour un visiteur
// mais le hub de l'app pour un élève connecté.
function pageSansBandeau(pathname: string): boolean {
  if (pathname === '/login' || isVitrine(pathname)) return true
  if (pathname !== '/' && PUBLIC_PATHS.has(pathname)) return true
  return SECTIONS_EXCLUES.some((s) => pathname === s || pathname.startsWith(`${s}/`))
}

// Monté dans app/layout.tsx. Rien n'est rendu côté serveur : plateforme,
// session et fermeture ne sont connues qu'après le montage.
export default function AppDownloadBanner() {
  const pathname = usePathname() ?? '/'
  const [plateforme, setPlateforme] = useState<Plateforme | null>(null)
  const [connecte, setConnecte] = useState(false)
  const [ferme, setFerme] = useState(false)

  useEffect(() => {
    setPlateforme(detecterPlateforme())
    try {
      if (localStorage.getItem(DISMISS_KEY)) setFerme(true)
    } catch {
      // Stockage indisponible : le bandeau reste fermable pour la session.
    }
  }, [])

  // INITIAL_SESSION à l'abonnement, puis connexion / déconnexion sans rechargement.
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      setConnecte(session != null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!plateforme || !connecte || ferme || pageSansBandeau(pathname)) return null
  // Safari iOS : bandeau natif d'Apple. Android : pas d'app.
  if (plateforme === 'ios-safari' || plateforme === 'android') return null

  function fermer() {
    setFerme(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Idem : fermeture limitée à la session.
    }
  }

  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        {plateforme === 'ordinateur' && (
          <QRCodeSVG value={APP_STORE_URL} size={56} className="shrink-0" aria-hidden />
        )}
        <p className="flex-1 text-sm text-text-primary">Monstro existe aussi sur iPhone.</p>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Télécharger l&apos;app
        </a>
        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer"
          className="shrink-0 rounded p-1 text-lg leading-none text-text-muted transition-colors hover:text-text-secondary"
        >
          ×
        </button>
      </div>
    </div>
  )
}
