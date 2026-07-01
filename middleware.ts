import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessibles sans plan payant (+ /login déjà géré en-dessous)
const WHITELIST = new Set(['/', '/profil', '/login'])

export async function middleware(request: NextRequest) {
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

  // Non authentifié → /login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Déjà connecté sur /login → /
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Contrôle de plan : seulement sur les routes hors liste blanche
  if (user && !WHITELIST.has(pathname)) {
    const { data: profile } = await supabase
      .from('user_profile')
      .select('plan, role')
      .eq('id', user.id)
      .single()

    const plan: string = profile?.plan ?? 'gratuit'
    const role: string = profile?.role ?? ''

    // Admin → accès complet toujours
    // plan 'classe' ou 'abonne' → accès complet
    // sinon → redirection vers /profil
    if (role !== 'admin' && plan !== 'classe' && plan !== 'abonne') {
      const url = request.nextUrl.clone()
      url.pathname = '/profil'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
