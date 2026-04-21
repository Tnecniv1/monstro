'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  email: string
  pseudo: string
  nom: string
  prenom: string
  avatarUrl: string | null
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
      className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}

export default function ProfilClient({ userId, email, pseudo: initPseudo, nom: initNom, prenom: initPrenom, avatarUrl: initAvatarUrl }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pseudo, setPseudo] = useState(initPseudo)
  const [nom, setNom] = useState(initNom)
  const [prenom, setPrenom] = useState(initPrenom)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initAvatarUrl)
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setLoading(true)
    setError(null)

    const { error: err } = await supabase
      .from('user_profile')
      .update({ pseudo, nom, prenom })
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
          <label className="block text-xs font-medium text-gray-600">Pseudo</label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-gray-600">Prénom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-gray-600">Nom</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      {/* Changement d'email */}
      <div className="border-t border-gray-100 pt-6">
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              Email actuel
            </label>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              Nouvel email
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouveau@email.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newEmail}
            className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Changer l&apos;email
          </button>
        </form>
      </div>
    </div>
  )
}
