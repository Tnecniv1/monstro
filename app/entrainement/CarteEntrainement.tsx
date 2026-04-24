'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Session = { temps_min: number; date: string }
export type Entrainement = {
  id: string
  ref_exo: number
  statut: string
  date_creation: string
  feuille_entrainement: { titre: string } | null
  observation: { etat: string } | null
  session: Session[]
}

const ETAT_STYLE: Record<string, string> = {
  succes: 'bg-green-100 text-green-700',
  echec: 'bg-red-100 text-red-700',
}
const ETAT_LABEL: Record<string, string> = {
  succes: 'Succès',
  echec: 'Échec',
}

function formatTemps(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type ActiveAction = 'session' | 'terminer' | null

export default function CarteEntrainement({
  e,
  enCours = false,
}: {
  e: Entrainement
  enCours?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [tempsMin, setTempsMin] = useState<number>(30)
  const [date, setDate] = useState<string>(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tempsTotal = e.session.reduce((sum, s) => sum + s.temps_min, 0)
  const derniereSession = e.session.map((s) => s.date).sort().reverse()[0] ?? null
  const dateAffichee = derniereSession ?? e.date_creation
  const feuille = e.feuille_entrainement
  const etat = e.observation?.etat ?? null

  function toggleAction(action: ActiveAction) {
    setActiveAction((prev) => (prev === action ? null : action))
    setError(null)
  }

  async function handleAjouterSession(ev: React.FormEvent) {
    ev.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase
      .from('session')
      .insert({ entrainement_id: e.id, date, temps_min: tempsMin })
    if (error) {
      setError(error.message)
    } else {
      setActiveAction(null)
      setTempsMin(30)
      setDate(todayISO())
      router.refresh()
    }
    setLoading(false)
  }

  async function handleTerminer(etatChoisi: 'succes' | 'echec') {
    setLoading(true)
    setError(null)
    const { error: e1 } = await supabase
      .from('observation')
      .update({ etat: etatChoisi, updated_at: new Date().toISOString() })
      .eq('entrainement_id', e.id)
    if (e1) { setError(e1.message); setLoading(false); return }
    const { error: e2 } = await supabase
      .from('entrainement')
      .update({ statut: 'termine' })
      .eq('id', e.id)
    if (e2) { setError(e2.message); setLoading(false); return }
    router.refresh()
  }

  return (
    <div
      className={`rounded-xl border bg-white space-y-0 overflow-hidden ${
        enCours ? 'border-black shadow-sm' : 'border-gray-200'
      }`}
    >
      {/* Corps principal */}
      <div className="p-5 space-y-3">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="font-semibold text-gray-900">
              {feuille?.titre ?? 'Sans titre'}
              <span className="text-gray-400 font-normal ml-1">— Exo {e.ref_exo}</span>
            </p>
            <p className="text-xs text-gray-400">{formatDate(dateAffichee)}</p>
          </div>
          {enCours && (
            <span className="shrink-0 rounded-full bg-black px-2.5 py-0.5 text-xs font-medium text-white">
              En cours
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          {etat && (
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium ${ETAT_STYLE[etat] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {ETAT_LABEL[etat] ?? etat}
            </span>
          )}
          {tempsTotal > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
              {formatTemps(tempsTotal)}
            </span>
          )}
        </div>

        {/* Actions — uniquement pour l'entraînement en cours */}
        {enCours && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => toggleAction('session')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeAction === 'session'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              + Ajouter une session
            </button>
            <button
              onClick={() => toggleAction('terminer')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeAction === 'terminer'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Terminer
            </button>
          </div>
        )}
      </div>

      {/* Panneau inline — Ajouter une session */}
      {enCours && activeAction === 'session' && (
        <form
          onSubmit={handleAjouterSession}
          className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3"
        >
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-medium text-gray-600">
                Durée (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={tempsMin}
                onChange={(ev) => setTempsMin(Number(ev.target.value))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs font-medium text-gray-600">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      )}

      {/* Panneau inline — Terminer */}
      {enCours && activeAction === 'terminer' && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
          <p className="text-xs font-medium text-gray-600">
            Comment s&apos;est passé cet entraînement ?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleTerminer('succes')}
              disabled={loading}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Succès
            </button>
            <button
              onClick={() => handleTerminer('echec')}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Échec
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
