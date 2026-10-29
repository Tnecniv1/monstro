'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Field, SubmitButton } from '@/app/components/AuthForm'
import VitrineShell from '@/app/components/VitrineShell'

// Pas de longueur minimale côté client, comme à l'inscription (AuthForm) :
// c'est le réglage Supabase Auth qui fait foi, et son erreur est traduite ici.
function messageErreur(error: AuthError): string {
  switch (error.code) {
    case 'weak_password':
      return 'Mot de passe trop faible ou trop court. Choisis-en un plus long.'
    case 'same_password':
      return "Le nouveau mot de passe doit être différent de l'ancien."
    case 'session_not_found':
    case 'session_expired':
      return 'Ta session a expiré. Refais une demande depuis « Identifiants oubliés ».'
    default:
      return "Impossible d'enregistrer le mot de passe. Réessaie dans un instant."
  }
}

export default function ReinitialiserMotDePassePage() {
  const router = useRouter()

  // null tant que la session n'est pas vérifiée
  const [connecte, setConnecte] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!cancelled) setConnecte(!!user)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !confirmation) return
    if (password !== confirmation) {
      setError('Les deux mots de passe ne sont pas identiques.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      console.error('updateUser (mot de passe) a échoué', error)
      setError(messageErreur(error))
      setLoading(false)
      return
    }
    setEnregistre(true)
    setTimeout(() => {
      router.replace('/')
      router.refresh()
    }, 1500)
  }

  return (
    <VitrineShell>
      <div className="flex flex-1 items-center justify-center py-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h1 className="text-base font-semibold text-gray-900">Nouveau mot de passe</h1>

          {connecte === false && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">Lien invalide ou expiré</p>
              <Link
                href="/identifiants-oublies"
                className="inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Refaire une demande
              </Link>
            </div>
          )}

          {connecte && enregistre && (
            <p className="text-sm text-gray-700">Mot de passe enregistré. Redirection…</p>
          )}

          {connecte && !enregistre && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field
                label="Nouveau mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
              <Field
                label="Confirmer le mot de passe"
                type="password"
                value={confirmation}
                onChange={setConfirmation}
                placeholder="••••••••"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <SubmitButton loading={loading} label="Enregistrer" disabled={!password || !confirmation} />
            </form>
          )}
        </div>
      </div>
    </VitrineShell>
  )
}
