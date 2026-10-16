'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SoldeJetons from '@/app/components/SoldeJetons'

// Admin : solde de jetons ADN d'un élève, avec ajout / retrait (motif
// ajustement_admin). Le plafond de 15 et le plancher de 0 sont appliqués en base.
export default function JetonsAdmin({ userId, soldeInitial }: { userId: string; soldeInitial: number }) {
  const [solde, setSolde] = useState(soldeInitial)
  const [quantite, setQuantite] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const n = Number(quantite)
  const valide = Number.isInteger(n) && n > 0

  async function ajuster(signe: 1 | -1) {
    if (!valide || busy) return
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().rpc('ajuster_tokens', { p_user_id: userId, p_delta: signe * n })
    if (error) setError(error.message)
    else setSolde(data as number)
    setBusy(false)
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Jetons ADN</h2>
        <SoldeJetons solde={solde} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          step={1}
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          aria-label="Nombre de jetons"
          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => ajuster(1)}
          disabled={!valide || busy}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => ajuster(-1)}
          disabled={!valide || busy}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Retirer
        </button>
      </div>
      <p className="text-xs text-gray-400">Solde entre 0 et 15 : un ajout au-delà de 15 est tronqué.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
