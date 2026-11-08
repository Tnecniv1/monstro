import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PUBLIC_PATHS, RECUPERATION_PATHS, hasAppAccess, isVitrine } from '@/lib/access'
import { SITE_URL } from '@/lib/site'
import { ROUTE_ONBOARDING, etapeOnboarding, premiereAssignation } from '@/lib/onboarding'
import { urlPublique } from '@/lib/urlPublique'

// Ancien sous-domaine Render, que Render ne sait pas rediriger lui-même.
const ANCIEN_HOST = 'monstro.onrender.com'

// Routes accessibles sans plan payant (+ /login déjà géré en-dessous)
const WHITELIST = new Set(['/', '/profil', '/login', '/mentions-legales', '/privacy', ...RECUPERATION_PATHS])

// Pages de la liste blanche jamais redirigées vers l'onboarding (les routes
// /api et /auth ne le sont pas non plus : voir plus bas).
const HORS_ONBOARDING = new Set(['/login', '/mentions-legales', '/privacy', '/robots.txt', '/sitemap.xml', ...RECUPERATION_PATHS])

export async function middleware(request: NextRequest) {
  // Routes cron et webhooks Twilio : pas de session, authentifiées dans la route elle-même
  // (CRON_SECRET, signature X-Twilio-Signature)
  const { pathname: chemin } = request.nextUrl
  if (chemin.startsWith('/api/cron/') || chemin.startsWith('/api/twilio/')) return NextResponse.next()

  // Ancien domaine → domaine personnalisé, en 301 avec chemin et query conservés.
  // GET et HEAD seulement : les autres méthodes passent (une 301 changerait un
  // POST en GET). Les routes cron, au-dessus, ne sont jamais redirigées.
  const host = request.headers.get('host')?.split(':')[0].toLowerCase()
  if (host === ANCIEN_HOST && (request.method === 'GET' || request.method === 'HEAD')) {
    const { pathname, search } = request.nextUrl
    return NextResponse.redirect(new URL(pathname + search, SITE_URL), 301)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Non authentifié hors routes publiques → / (page d'accueil avec formulaire de connexion)
  // Redirections sur l'origine publique (cf. lib/urlPublique), query conservée.
  if (!user && !PUBLIC_PATHS.has(pathname) && !isVitrine(pathname)) {
    return NextResponse.redirect(urlPublique(request, '/', request.nextUrl.search))
  }

  // Déjà connecté sur /login → /
  if (user && pathname === '/login') {
    return NextResponse.redirect(urlPublique(request, '/', request.nextUrl.search))
  }

  // Contrôle de plan (routes hors liste blanche) et onboarding (toutes les
  // pages de l'app, liste blanche comprise : « / » et /profil aussi).
  const controlePlan = !WHITELIST.has(pathname)
  if (user && !isVitrine(pathname) && (controlePlan || !HORS_ONBOARDING.has(pathname))) {
    // Une seule requête : profil et ligne parcours_eleve (relation un-à-un).
    const lecture = await supabase
      .from('user_profile')
      .select('plan, role, script1_ouvert_at, parcours_eleve ( positionnement_at )')
      .eq('id', user.id)
      .single()
    let profile = lecture.data
    const error = lecture.error
    let onboardingLisible = !error
    if (error) {
      // Jamais de redirection à tort : relecture du seul profil, sans onboarding.
      console.error('[middleware] lecture profil + parcours_eleve', error.message)
      const repli = await supabase.from('user_profile').select('plan, role').eq('id', user.id).single()
      profile = repli.data as typeof profile
      onboardingLisible = false
    }

    // Pas d'accès (cf. hasAppAccess) → redirection vers /profil
    if (controlePlan && !hasAppAccess(profile?.role, profile?.plan)) {
      return NextResponse.redirect(urlPublique(request, '/profil', request.nextUrl.search))
    }

    const routeTechnique = pathname.startsWith('/api/') || pathname.startsWith('/auth/')
    if (onboardingLisible && profile && !routeTechnique) {
      const etape = etapeOnboarding({
        role: profile.role,
        plan: profile.plan,
        script1OuvertAt: profile.script1_ouvert_at,
        assignation: premiereAssignation(profile.parcours_eleve),
      })
      // Onboarding à faire : aucune autre page tant qu'il n'est pas fini.
      if (etape && pathname !== ROUTE_ONBOARDING) {
        return NextResponse.redirect(urlPublique(request, ROUTE_ONBOARDING, ''))
      }
      // Rien à faire (ou admin) : /bienvenue renvoie à l'accueil.
      if (!etape && pathname === ROUTE_ONBOARDING) {
        return NextResponse.redirect(urlPublique(request, '/', ''))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
