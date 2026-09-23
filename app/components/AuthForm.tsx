'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveLoginEmail } from '@/lib/auth/resolveLoginEmail'

type Tab = 'connexion' | 'inscription'

export default function AuthForm() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('connexion')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Connexion
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Inscription
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')

  function switchTab(t: Tab) {
    setTab(t)
    setError(null)
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const { email: loginEmail, error: resolveError } = await resolveLoginEmail(supabase, email)
    if (resolveError || !loginEmail) {
      setError(resolveError ?? 'Pseudo introuvable')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!prenom.trim() || !nom.trim() || !pseudo.trim() || !signUpEmail.trim() || !signUpPassword) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPassword,
      options: {
        data: { prenom, nom, pseudo },
      },
    })
    if (error) {
      setError(error.message)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      {/* Tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => switchTab('connexion')}
          className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
            tab === 'connexion'
              ? 'bg-accent text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Connexion
        </button>
        <button
          onClick={() => switchTab('inscription')}
          className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
            tab === 'inscription'
              ? 'bg-accent text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Inscription
        </button>
      </div>

      {/* Formulaire connexion */}
      {tab === 'connexion' && (
        <form onSubmit={handleSignIn} className="space-y-3">
          <Field label="Pseudo ou Email" type="text" value={email} onChange={setEmail} placeholder="pseudo ou toi@exemple.com" />
          <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          {/* Message applicatif — ne dépend pas de la bulle de validation
              native du navigateur (peu visible, notamment sur mobile Safari). */}
          {!error && (!email.trim() || !password) && (
            <p className="text-xs text-amber-600">Renseigne ton pseudo/email et ton mot de passe.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SubmitButton loading={loading} label="Se connecter" disabled={!email.trim() || !password} />
        </form>
      )}

      {/* Formulaire inscription */}
      {tab === 'inscription' && (
        <form onSubmit={handleSignUp} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" type="text" value={prenom} onChange={setPrenom} placeholder="Jean" />
            <Field label="Nom" type="text" value={nom} onChange={setNom} placeholder="Dupont" />
          </div>
          <Field label="Pseudo" type="text" value={pseudo} onChange={setPseudo} placeholder="@jdupont" />
          <Field label="Email" type="email" value={signUpEmail} onChange={setSignUpEmail} placeholder="toi@exemple.com" />
          <Field label="Mot de passe" type="password" value={signUpPassword} onChange={setSignUpPassword} placeholder="••••••••" />
          {!error && (!prenom.trim() || !nom.trim() || !pseudo.trim() || !signUpEmail.trim() || !signUpPassword) && (
            <p className="text-xs text-amber-600">Remplis tous les champs pour créer ton compte.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SubmitButton
            loading={loading}
            label="Créer mon compte"
            disabled={!prenom.trim() || !nom.trim() || !pseudo.trim() || !signUpEmail.trim() || !signUpPassword}
          />
        </form>
      )}
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  )
}

function SubmitButton({
  loading,
  label,
  disabled = false,
}: {
  loading: boolean
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full bg-accent text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {loading ? 'Chargement…' : label}
    </button>
  )
}
