import type { NextRequest } from 'next/server'

// Origine publique du site pour les redirections envoyées au navigateur.
// Derrière le proxy Render, request.url porte l'adresse interne
// (http://localhost:10000) : on lui préfère, dans l'ordre,
//   1. x-forwarded-host / x-forwarded-proto posés par le proxy, si l'hôte est autorisé,
//   2. NEXT_PUBLIC_SITE_URL s'il est défini,
//   3. request.url (développement local).
// Sans dépendance Node : utilisable dans le middleware (runtime Edge).
export function originePublique(request: NextRequest): string {
  const host = premiereValeur(request.headers.get('x-forwarded-host')).toLowerCase()
  if (hoteAutorise(host)) {
    const proto = premiereValeur(request.headers.get('x-forwarded-proto')) === 'http' ? 'http' : 'https'
    return `${proto}://${host}`
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  if (site) return site
  return new URL(request.url).origin
}

// URL absolue sur l'origine publique. search : '' ou '?a=b'.
export function urlPublique(request: NextRequest, pathname: string, search = ''): URL {
  return new URL(pathname + search, originePublique(request))
}

// x-forwarded-host peut venir du client : seuls nos domaines et localhost
// (avec ou sans port) sont acceptés, sinon on passe aux solutions suivantes.
const HOTES_AUTORISES = new Set(['monstro.fr', 'www.monstro.fr'])

function hoteAutorise(host: string): boolean {
  return HOTES_AUTORISES.has(host) || /^localhost(:\d{1,5})?$/.test(host)
}

// Un proxy peut empiler plusieurs valeurs (« a, b ») : la première est celle du client.
function premiereValeur(valeur: string | null): string {
  return valeur?.split(',')[0].trim() ?? ''
}
