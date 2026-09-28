// Règles d'accès partagées entre middleware.ts et l'onboarding
// (app/onboarding/OnboardingGate.tsx). Pur TypeScript : utilisable en edge.

// Routes accessibles sans authentification (correspondance exacte)
export const PUBLIC_PATHS = new Set(['/', '/mentions-legales', '/privacy', '/robots.txt', '/sitemap.xml'])

// Sections vitrine publiques pour tous, sous-pages comprises (ex. futur /philosophie/[slug])
const VITRINE_SECTIONS = ['/voyage', '/problemes', '/philosophie']

export function isVitrine(pathname: string): boolean {
  return VITRINE_SECTIONS.some((s) => pathname === s || pathname.startsWith(`${s}/`))
}

// Admin → accès complet toujours
// plan 'classe', 'abonne' ou 'essai' → accès complet
// sinon → pas d'accès aux routes hors liste blanche
export function hasAppAccess(role: string | null | undefined, plan: string | null | undefined): boolean {
  const p = plan ?? 'gratuit'
  return role === 'admin' || p === 'classe' || p === 'abonne' || p === 'essai'
}
