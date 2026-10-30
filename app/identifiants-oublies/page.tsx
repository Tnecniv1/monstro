'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Field, SubmitButton } from '@/app/components/AuthForm'
import VitrineShell from '@/app/components/VitrineShell'

// Même message que le compte existe ou non : la page ne doit pas révéler
// quels pseudos ou emails sont inscrits.
const MESSAGE_ENVOI =
  "Si un compte correspond, un email vient d'être envoyé avec ton pseudo et un lien pour choisir un nouveau mot de passe."

export default function IdentifiantsOubliesPage() {
  return (
    <VitrineShell>
      <div className="flex flex-1 items-center justify-center py-6">
        <div className="w-full max-w-sm space-y-3">
          {/* useSearchParams exige une frontière Suspense au build */}
          <Suspense>
            <Formulaire />
          </Suspense>
          <Link
            href="/"
            className="inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </VitrineShell>
  )
}

function Formulaire() {
  const searchParams = useSearchParams()
  const lienExpire = searchParams.get('erreur') === 'lien-expire'

  const [identifiant, setIdentifiant] = useState('')
  const [loading, setLoading] = useState(false)
  const [envoye, setEnvoye] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!identifiant.trim() || envoye) return
    setLoading(true)
    try {
      // auth-pseudo résout pseudo ou email côté serveur et répond toujours 200.
      const { error } = await createClient().functions.invoke('auth-pseudo', {
        body: { action: 'oubli', identifiant: identifiant.trim() },
      })
      if (error) console.error('Identifiants oubliés : auth-pseudo a échoué', error)
    } catch (err) {
      console.error('Identifiants oubliés : erreur inattendue', err)
    }
    setEnvoye(true)
    setLoading(false)
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h1 className="text-base font-semibold text-gray-900">Identifiants oubliés</h1>
      {lienExpire && (
        <p className="text-sm text-red-600">Ce lien a expiré ou a déjà été utilisé. Refais une demande.</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label="Pseudo ou Email"
          type="text"
          value={identifiant}
          onChange={setIdentifiant}
          placeholder="pseudo ou toi@exemple.com"
        />
        {envoye && <p className="text-sm text-gray-700">{MESSAGE_ENVOI}</p>}
        <SubmitButton
          loading={loading}
          label="Recevoir mes identifiants"
          disabled={envoye || !identifiant.trim()}
        />
      </form>
    </div>
  )
}
