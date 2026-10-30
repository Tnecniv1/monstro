'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Tab = 'connexion' | 'inscription'

// Même message pour un pseudo inconnu, un email inconnu ou un mauvais mot de
// passe : la connexion ne doit pas révéler quels comptes existent.
const MESSAGE_IDENTIFIANTS_INVALIDES = 'Identifiant ou mot de passe incorrect.'
const MESSAGE_TROP_DE_TENTATIVES = 'Trop de tentatives, réessaie dans quelques minutes.'
const MESSAGE_ERREUR = 'Une erreur est survenue. Réessaie.'

export default function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // /?mode=inscription ouvre directement l'onglet Inscription
  const [tab, setTab] = useState<Tab>(searchParams.get('mode') === 'inscription' ? 'inscription' : 'connexion')
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
    const identifiant = email.trim()
    if (!identifiant || !password) return
    setLoading(true)
    setError(null)
    const erreur = identifiant.includes('@')
      ? await connexionParEmail(identifiant)
      : await connexionParPseudo(identifiant)
    if (erreur) {
      setError(erreur)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  // Renvoie le message d'erreur à afficher, ou null si la session est ouverte.
  async function connexionParEmail(adresse: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email: adresse, password })
    if (!error) return null
    if (error.code === 'invalid_credentials') return MESSAGE_IDENTIFIANTS_INVALIDES
    if (error.status === 429) return MESSAGE_TROP_DE_TENTATIVES
    return error.message
  }

  // L'Edge Function auth-pseudo résout le pseudo côté serveur et renvoie les
  // jetons de session, sans jamais exposer l'email.
  async function connexionParPseudo(identifiant: string): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>(
      'auth-pseudo',
      { body: { action: 'connexion', identifiant, password } },
    )
    if (error) {
      const status = error instanceof FunctionsHttpError ? (error.context as Response).status : null
      if (status === 401) return MESSAGE_IDENTIFIANTS_INVALIDES
      if (status === 429) return MESSAGE_TROP_DE_TENTATIVES
      console.error('auth-pseudo connexion a échoué', error)
      return MESSAGE_ERREUR
    }
    if (!data) {
      console.error('auth-pseudo connexion : réponse vide')
      return MESSAGE_ERREUR
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
    if (sessionError) {
      console.error('setSession a échoué', sessionError)
      return MESSAGE_ERREUR
    }
    return null
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
          <Link
            href="/identifiants-oublies"
            className="inline-block text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            Identifiants oubliés&nbsp;?
          </Link>
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

export function Field({
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

export function SubmitButton({
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
