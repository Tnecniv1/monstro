'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  email: string
  pseudo: string
  nom: string
  prenom: string
  avatarUrl: string | null
  telephone: string
  dateNaissance: string
  ville: string
}

interface CommuneSuggestion {
  nom: string
  code: string
}

function Avatar({ url, pseudo, size }: { url: string | null; pseudo: string; size: number }) {
  const initial = pseudo ? pseudo[0].toUpperCase() : '?'
  if (url) {
    return (
      <img
        src={url}
        alt={pseudo}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-surface-2 flex items-center justify-center font-semibold text-text-secondary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}

export default function ProfilClient({
  userId, email, pseudo: initPseudo, nom: initNom, prenom: initPrenom,
  avatarUrl: initAvatarUrl, telephone: initTelephone,
  dateNaissance: initDateNaissance, ville: initVille,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pseudo, setPseudo] = useState(initPseudo)
  const [nom, setNom] = useState(initNom)
  const [prenom, setPrenom] = useState(initPrenom)
  const [telephone, setTelephone] = useState(initTelephone)
  const [dateNaissance, setDateNaissance] = useState(initDateNaissance)
  const [ville, setVille] = useState(initVille)
  const [suggestionsVille, setSuggestionsVille] = useState<CommuneSuggestion[]>([])
  const [showSuggestionsVille, setShowSuggestionsVille] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initAvatarUrl)
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleVilleChange(value: string) {
    setVille(value)
    setShowSuggestionsVille(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setSuggestionsVille([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(value)}&fields=nom,code&boost=population&limit=10`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as CommuneSuggestion[]
        setSuggestionsVille(data)
      } catch (err) {
        console.error('[ProfilClient] erreur autocomplétion ville:', err)
        setSuggestionsVille([])
      }
    }, 300)
  }

  function selectionnerVille(nom: string) {
    setVille(nom)
    setSuggestionsVille([])
    setShowSuggestionsVille(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAvatarChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    setError(null)

    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setAvatarLoading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('user_profile')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setAvatarUrl(publicUrl)
      router.refresh()
    }
    setAvatarLoading(false)
  }

  async function handleSaveProfile(ev: React.FormEvent) {
    ev.preventDefault()
    if (!dateNaissance || !ville) {
      setError('Date de naissance et ville sont obligatoires.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: err } = await supabase
      .from('user_profile')
      .update({ pseudo, nom, prenom, telephone: telephone || null, date_naissance: dateNaissance, ville })
      .eq('id', userId)

    if (err) {
      setError(err.message)
    } else {
      showToast('Profil mis à jour')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleChangeEmail(ev: React.FormEvent) {
    ev.preventDefault()
    if (!newEmail) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.updateUser({ email: newEmail })

    if (err) {
      setError(err.message)
    } else {
      showToast('Email de confirmation envoyé')
      setNewEmail('')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative group"
          disabled={avatarLoading}
        >
          <Avatar url={avatarUrl} pseudo={pseudo} size={96} />
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-medium">
              {avatarLoading ? '…' : 'Changer'}
            </span>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Infos profil */}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">Pseudo</label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">Téléphone</label>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78"
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted">Date de naissance</label>
          <input
            type="date"
            value={dateNaissance}
            onChange={(e) => setDateNaissance(e.target.value)}
            max={todayStr}
            required
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="space-y-1 relative">
          <label className="block text-xs font-medium text-text-muted">Ville</label>
          <input
            type="text"
            value={ville}
            onChange={(e) => handleVilleChange(e.target.value)}
            onFocus={() => setShowSuggestionsVille(true)}
            onBlur={() => setTimeout(() => setShowSuggestionsVille(false), 150)}
            required
            autoComplete="off"
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {showSuggestionsVille && suggestionsVille.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-md max-h-48 overflow-y-auto text-sm">
              {suggestionsVille.map((s) => (
                <li key={s.code}>
                  <button
                    type="button"
                    onClick={() => selectionnerVille(s.nom)}
                    className="w-full text-left px-3 py-2 text-text-primary hover:bg-surface-2"
                  >
                    {s.nom}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-text-muted">Prénom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-text-muted">Nom</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !dateNaissance || !ville}
          className="w-full rounded-lg bg-accent text-bg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      {/* Changement d'email */}
      <div className="border-t border-border pt-6">
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted">
              Email actuel
            </label>
            <p className="text-sm text-text-secondary">{email}</p>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted">
              Nouvel email
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouveau@email.com"
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newEmail}
            className={`w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              newEmail
                ? 'bg-surface-2 border border-border-strong text-text-primary hover:bg-surface'
                : 'bg-surface-2 text-text-muted'
            }`}
          >
            Changer l&apos;email
          </button>
        </form>
      </div>
    </div>
  )
}
