import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { urlPublique } from '@/lib/urlPublique'

// Lien de l'email « Identifiants oubliés » : /auth/confirm?token_hash=…&type=recovery.
// verifyOtp ouvre la session de récupération ; le client serveur l'écrit via
// cookies() de next/headers, et Next reporte ces cookies sur la redirection.
// Redirections sur l'origine publique (pas request.url, interne chez Render).
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')

  // Seul le type recovery est accepté : le succès mène toujours à la page
  // de nouveau mot de passe.
  if (tokenHash && type === 'recovery') {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return NextResponse.redirect(urlPublique(request, '/reinitialiser-mot-de-passe'))
    }
    console.error('auth/confirm : verifyOtp a échoué', error)
  }

  return NextResponse.redirect(urlPublique(request, '/identifiants-oublies', '?erreur=lien-expire'))
}
