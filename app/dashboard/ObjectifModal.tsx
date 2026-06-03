'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FeuilleOption {
  feuille_id: string
  titre: string
  volume: number
}

interface Props {
  userId: string
  jourSemaine: number
  jourNom: string
  initialFeuilleId: string | null
  initialRefExercice: number | null
  initialNote: string | null
  onClose: () => void
  onSave: () => void
}

export default function ObjectifModal({
  userId,
  jourSemaine,
  jourNom,
  initialFeuilleId,
  initialRefExercice,
  initialNote,
  onClose,
  onSave,
}: Props) {
  const supabase = createClient()
  const [feuilles, setFeuilles] = useState<FeuilleOption[]>([])
  const [feuilleId, setFeuilleId] = useState<string>(initialFeuilleId ?? '')
  const [refExercice, setRefExercice] = useState<string>(initialRefExercice?.toString() ?? '')
  const [note, setNote] = useState<string>(initialNote ?? '')
  const [loading, setLoading] = useState(false)
  const [loadingFeuilles, setLoadingFeuilles] = useState(true)

  useEffect(() => {
    async function fetchFeuilles() {
      const { data: focusData } = await supabase
        .from('feuille_focus')
        .select('feuille_id')
        .eq('user_id', userId)

      const feuilleIds = focusData?.map((f: { feuille_id: string }) => f.feuille_id) ?? []

      if (feuilleIds.length > 0) {
        const { data: feuillesData } = await supabase
          .from('feuille_entrainement')
          .select('id, volume, noeud:noeud_id(nom)')
          .in('id', feuilleIds)

        if (feuillesData) {
          setFeuilles(
            (feuillesData as unknown as { id: string; volume: number; noeud: { nom: string } }[]).map((f) => ({
              feuille_id: f.id,
              titre: f.noeud?.nom ?? f.id,
              volume: f.volume ?? 0,
            }))
          )
        }
      }
      setLoadingFeuilles(false)
    }
    fetchFeuilles()
  }, [userId])

  const selectedFeuille = feuilles.find((f) => f.feuille_id === feuilleId)

  async function handleSave() {
    setLoading(true)
    await supabase.from('objectif_regularite').upsert(
      {
        user_id: userId,
        jour_semaine: jourSemaine,
        feuille_id: feuilleId || null,
        ref_exercice: refExercice ? parseInt(refExercice, 10) : null,
        note: note.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,jour_semaine' }
    )
    setLoading(false)
    onSave()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">
          Objectif — {jourNom}
        </h2>

        {loadingFeuilles ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : feuilles.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Aucune feuille en focus actuellement.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Feuille</label>
              <select
                value={feuilleId}
                onChange={(e) => { setFeuilleId(e.target.value); setRefExercice('') }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="">— Aucune —</option>
                {feuilles.map((f) => (
                  <option key={f.feuille_id} value={f.feuille_id}>{f.titre}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Exercice</label>
              <select
                value={refExercice}
                onChange={(e) => setRefExercice(e.target.value)}
                disabled={!selectedFeuille}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white disabled:opacity-40"
              >
                <option value="">— Aucun —</option>
                {selectedFeuille &&
                  Array.from({ length: selectedFeuille.volume }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
              </select>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Remarque, conseil, contexte…"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none"
          />
          <p className="text-xs text-gray-400 text-right">{note.length}/300</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm bg-gray-900 text-white hover:opacity-85 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
