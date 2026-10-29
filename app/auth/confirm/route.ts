import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lien de l'email « Identifiants oubliés » : /auth/confirm?token_hash=…&type=recovery.
// verifyOtp ouvre la session de récupération ; le client serveur l'écrit via
// cookies() de next/headers, et Next reporte ces cookies sur la redirection.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')

  const url = request.nextUrl.clone()
  url.search = ''

  // Seul le type recovery est accepté : le succès mène toujours à la page
  // de nouveau mot de passe.
  if (tokenHash && type === 'recovery') {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      url.pathname = '/reinitialiser-mot-de-passe'
      return NextResponse.redirect(url)
    }
    console.error('auth/confirm : verifyOtp a échoué', error)
  }

  url.pathname = '/identifiants-oublies'
  url.searchParams.set('erreur', 'lien-expire')
  return NextResponse.redirect(url)
}
