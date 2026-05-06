'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Compteurs = {
  c1: number; c2: number; c3: number; c4: number
  s1: number; s2: number; s3: number; s4: number
  r1: number; r2: number; r3: number; r4: number
}

const INITIAL: Compteurs = {
  c1: 0, c2: 0, c3: 0, c4: 0,
  s1: 0, s2: 0, s3: 0, s4: 0,
  r1: 0, r2: 0, r3: 0, r4: 0,
}

function Row({
  label,
  value,
  onInc,
  onDec,
}: {
  label: string
  value: number
  onInc: () => void
  onDec: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-sm font-medium text-gray-700 uppercase">{label}</span>
      <span className="w-6 text-center text-sm text-gray-900">{value}</span>
      <button
        onClick={onInc}
        className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors text-sm font-medium"
      >
        +
      </button>
      <button
        onClick={onDec}
        className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors text-sm font-medium"
      >
        −
      </button>
    </div>
  )
}

export default function ErreurModal({
  entrainementId,
  onClose,
}: {
  entrainementId: string
  onClose: () => void
}) {
  const supabase = createClient()
  const [compteurs, setCompteurs] = useState<Compteurs>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('erreur')
        .select('*')
        .eq('entrainement_id', entrainementId)
        .single()
      if (data) {
        setCompteurs({
          c1: data.c1 ?? 0, c2: data.c2 ?? 0, c3: data.c3 ?? 0, c4: data.c4 ?? 0,
          s1: data.s1 ?? 0, s2: data.s2 ?? 0, s3: data.s3 ?? 0, s4: data.s4 ?? 0,
          r1: data.r1 ?? 0, r2: data.r2 ?? 0, r3: data.r3 ?? 0, r4: data.r4 ?? 0,
        })
      }
      setLoading(false)
    }
    load()
  }, [entrainementId])

  function inc(key: keyof Compteurs) {
    setCompteurs(prev => ({ ...prev, [key]: prev[key] + 1 }))
  }

  function dec(key: keyof Compteurs) {
    setCompteurs(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('erreur')
      .upsert({ entrainement_id: entrainementId, ...compteurs }, { onConflict: 'entrainement_id' })
    if (err) {
      setError(err.message)
    } else {
      onClose()
    }
    setSaving(false)
  }

  const section = (titre: string, keys: (keyof Compteurs)[]) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titre}</p>
      {keys.map(k => (
        <Row
          key={k}
          label={k}
          value={compteurs[k]}
          onInc={() => inc(k)}
          onDec={() => dec(k)}
        />
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl max-w-sm w-full mx-4 p-6 space-y-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Erreurs</h2>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Chargement…</p>
        ) : (
          <div className="space-y-5">
            {section('Compréhension', ['c1', 'c2', 'c3', 'c4'])}
            <div className="border-t border-gray-100" />
            {section('Savoir', ['s1', 's2', 's3', 's4'])}
            <div className="border-t border-gray-100" />
            {section('Rédaction', ['r1', 'r2', 'r3', 'r4'])}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
