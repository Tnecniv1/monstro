'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'connexion' | 'inscription'

export default function LoginPage() {
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
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/entrainement')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
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
      router.push('/entrainement')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Monstro</h1>

        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => switchTab('connexion')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'connexion'
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => switchTab('inscription')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === 'inscription'
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Inscription
          </button>
        </div>

        {/* Formulaire connexion */}
        {tab === 'connexion' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="toi@exemple.com" />
            <Field label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <SubmitButton loading={loading} label="Se connecter" />
          </form>
        )}

        {/* Formulaire inscription */}
        {tab === 'inscription' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" type="text" value={prenom} onChange={setPrenom} placeholder="Jean" />
              <Field label="Nom" type="text" value={nom} onChange={setNom} placeholder="Dupont" />
            </div>
            <Field label="Pseudo" type="text" value={pseudo} onChange={setPseudo} placeholder="@jdupont" />
            <Field label="Email" type="email" value={signUpEmail} onChange={setSignUpEmail} placeholder="toi@exemple.com" />
            <Field label="Mot de passe" type="password" value={signUpPassword} onChange={setSignUpPassword} placeholder="••••••••" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <SubmitButton loading={loading} label="Créer mon compte" />
          </form>
        )}
      </div>
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
    </div>
  )
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Chargement…' : label}
    </button>
  )
}
