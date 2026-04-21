'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NoeudBase = { id: string; nom: string; parent_id: string | null }
type Noeud = NoeudBase & {
  parent: (NoeudBase & { grandparent: NoeudBase | null }) | null
}
type Feuille = {
  id: string
  titre: string
  volume: number
  ordre: number
  noeud: Noeud | null
}

type Step = 'feuille' | 'exercice'

function cheminFeuille(feuille: Feuille): string {
  const n = feuille.noeud
  const parts: string[] = []
  if (n?.parent?.grandparent?.nom) parts.push(n.parent.grandparent.nom)
  if (n?.parent?.nom) parts.push(n.parent.nom)
  if (n?.nom) parts.push(n.nom)
  return parts.join(' › ')
}

export default function NouvelEntrainementModal({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('feuille')
  const [feuilles, setFeuilles] = useState<Feuille[]>([])
  const [recherche, setRecherche] = useState('')
  const [feuille, setFeuille] = useState<Feuille | null>(null)
  const [refExo, setRefExo] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('feuille_entrainement')
      .select(`
        id, titre, volume, ordre,
        noeud:noeud_id (
          id, nom, parent_id,
          parent:parent_id (
            id, nom, parent_id,
            grandparent:parent_id ( id, nom )
          )
        )
      `)
      .order('ordre')
      .then(({ data }) => setFeuilles((data as unknown as Feuille[]) ?? []))
  }, [])

  const feuillesFiltrees = useMemo(() => {
    const q = recherche.toLowerCase()
    if (!q) return feuilles
    return feuilles.filter((f) => {
      const chemin = cheminFeuille(f).toLowerCase()
      return f.titre.toLowerCase().includes(q) || chemin.includes(q)
    })
  }, [feuilles, recherche])

  function choisirFeuille(f: Feuille) {
    setFeuille(f)
    setRefExo(1)
    setError(null)
    setStep('exercice')
  }

  async function handleCommencer() {
    if (!feuille) return
    setLoading(true)
    setError(null)

    const { data: e, error: errInsert } = await supabase
      .from('entrainement')
      .insert({ user_id: userId, feuille_id: feuille.id, ref_exo: refExo, statut: 'en_cours' })
      .select('id')
      .single()

    if (errInsert || !e) {
      setError(errInsert?.message ?? 'Erreur lors de la création.')
      setLoading(false)
      return
    }

    await supabase.from('observation').insert({ entrainement_id: e.id, etat: null })

    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">
            {step === 'feuille' ? 'Choisir une feuille' : feuille?.titre}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Étape 1 : choisir la feuille */}
        {step === 'feuille' && (
          <>
            <div className="px-6 pt-4 shrink-0">
              <input
                type="text"
                placeholder="Rechercher par titre ou chemin…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <ul className="overflow-y-auto flex-1 px-6 py-3 space-y-1">
              {feuillesFiltrees.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">
                  Aucune feuille trouvée.
                </p>
              )}
              {feuillesFiltrees.map((f) => {
                const chemin = cheminFeuille(f)
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => choisirFeuille(f)}
                      className="w-full text-left rounded-lg px-3 py-3 hover:bg-gray-50 transition-colors space-y-0.5"
                    >
                      <p className="text-sm font-medium text-gray-900">{f.titre}</p>
                      <p className="text-xs text-gray-400">
                        {chemin && `${chemin} · `}
                        {f.volume} exercice{f.volume > 1 ? 's' : ''}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* Étape 2 : choisir l'exercice */}
        {step === 'exercice' && feuille && (
          <div className="px-6 py-6 space-y-6 flex-1">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Feuille sélectionnée</p>
              <p className="text-sm text-gray-700">{cheminFeuille(feuille) || '—'}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Numéro d&apos;exercice
                <span className="ml-1 font-normal text-gray-400">(1 – {feuille.volume})</span>
              </label>
              <input
                type="number"
                min={1}
                max={feuille.volume}
                value={refExo}
                onChange={(e) => setRefExo(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setStep('feuille'); setError(null) }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Retour
              </button>
              <button
                onClick={handleCommencer}
                disabled={loading || refExo < 1 || refExo > feuille.volume}
                className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Création…' : 'Commencer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
