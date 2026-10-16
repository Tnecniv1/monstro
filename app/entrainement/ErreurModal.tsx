'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CLES_ERREURS, SECTIONS_ERREURS, compteursVides, type CleErreur, type CompteursErreurs } from '@/lib/erreurs'

const COMPTEUR_BTN =
  'flex w-8 h-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors text-sm font-medium'

function Row({
  code,
  description,
  value,
  onInc,
  onDec,
}: {
  code: string
  description: string
  value: number
  onInc: () => void
  onDec: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-7 shrink-0 pt-1.5 text-sm font-semibold text-gray-900">{code}</span>
      <span className="min-w-0 flex-1 pt-1.5 text-sm text-gray-500">{description}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onDec} aria-label={`Retirer une erreur ${code}`} className={COMPTEUR_BTN}>
          −
        </button>
        <span className="w-6 text-center text-sm tabular-nums text-gray-900">{value}</span>
        <button type="button" onClick={onInc} aria-label={`Ajouter une erreur ${code}`} className={COMPTEUR_BTN}>
          +
        </button>
      </div>
    </div>
  )
}

export default function ErreurModal({
  entrainementId,
  onClose,
  onSaved,
}: {
  entrainementId: string
  onClose: () => void
  // Enregistrement réussi : la carte se met à jour (bouton E / total).
  onSaved: () => void
}) {
  const supabase = createClient()
  const [compteurs, setCompteurs] = useState<CompteursErreurs>(compteursVides)
  const [loading, setLoading] = useState(true)
  // Lecture échouée : Enregistrer reste désactivé, pour ne pas écraser une
  // ligne existante qu'on n'a pas pu lire.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // maybeSingle : pas de ligne → data null sans erreur (compteurs à 0).
      const { data, error: err } = await supabase
        .from('erreur')
        .select('*')
        .eq('entrainement_id', entrainementId)
        .maybeSingle()
      if (err) {
        setLoadError(err.message)
      } else if (data) {
        const lus = compteursVides()
        for (const k of CLES_ERREURS) lus[k] = data[k] ?? 0
        setCompteurs(lus)
      }
      setLoading(false)
    }
    load()
  }, [entrainementId])

  function inc(key: CleErreur) {
    setCompteurs(prev => ({ ...prev, [key]: prev[key] + 1 }))
  }

  function dec(key: CleErreur) {
    setCompteurs(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))
  }

  async function handleSave() {
    if (loadError) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('erreur')
      .upsert({ entrainement_id: entrainementId, ...compteurs }, { onConflict: 'entrainement_id' })
    if (err) {
      setError(err.message)
    } else {
      onSaved()
    }
    setSaving(false)
  }

  // Sur téléphone : la modale tient dans l'écran, seule la liste défile ;
  // en-tête et boutons restent visibles.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-full w-full max-w-md flex-col rounded-xl bg-white shadow-lg">
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-sm font-semibold text-gray-900">Erreurs</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-xs text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Chargement…</p>
          ) : loadError ? (
            <p className="text-sm text-red-600 py-4">Impossible de lire les erreurs : {loadError}</p>
          ) : (
            <div className="space-y-5 pb-2">
              {SECTIONS_ERREURS.map((section, i) => (
                <div key={section.titre} className="space-y-5">
                  {i > 0 && <div className="border-t border-gray-100" />}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{section.titre}</p>
                    {section.items.map((item) => (
                      <Row
                        key={item.cle}
                        code={item.code}
                        description={item.description}
                        value={compteurs[item.cle]}
                        onInc={() => inc(item.cle)}
                        onDec={() => dec(item.cle)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-gray-100 px-6 pt-4 pb-6">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !!loadError}
              className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
