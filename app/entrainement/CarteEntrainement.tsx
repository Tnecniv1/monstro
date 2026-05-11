'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ErreurModal from './ErreurModal'

type Session = { temps_min: number; date: string }
type ErreurCounts = {
  c1: number; c2: number; c3: number; c4: number
  s1: number; s2: number; s3: number; s4: number
  r1: number; r2: number; r3: number; r4: number
}
type CorrectionTentative = { id: string; statut: string; date_creation: string }

export type Entrainement = {
  id: string
  ref_exo: number
  statut: string
  date_creation: string
  feuille_entrainement: { titre: string; correction: { pdf_url: string } | null } | null
  observation: { etat: string } | null
  session: Session[]
  erreur: ErreurCounts | ErreurCounts[] | null
  correction_tentative: CorrectionTentative[]
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
  correctionEnCours = false,
  canStartCorrection = false,
}: {
  e: Entrainement
  enCours?: boolean
  correctionEnCours?: boolean
  canStartCorrection?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [tempsMin, setTempsMin] = useState<number>(30)
  const [date, setDate] = useState<string>(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErreurs, setShowErreurs] = useState(false)

  const tempsTotal = e.session.reduce((sum, s) => sum + s.temps_min, 0)
  const derniereSession = e.session.map((s) => s.date).sort().reverse()[0] ?? null
  const dateAffichee = derniereSession ?? e.date_creation
  const feuille = e.feuille_entrainement
  const correction = feuille?.correction ?? null
  const etat = e.observation?.etat ?? null

  const erreurData = Array.isArray(e.erreur) ? e.erreur[0] ?? null : e.erreur ?? null
  const totalErreurs = erreurData
    ? Object.values(erreurData).reduce((sum: number, v) => sum + (v as number), 0)
    : null

  const lastSession = e.session.map((s) => s.date).sort().reverse()[0]
  const refDate = lastSession ?? e.date_creation
  const isOlderThan24h =
    e.statut === 'termine' &&
    new Date().getTime() - new Date(refDate).getTime() > 24 * 60 * 60 * 1000

  const erreurLabel = totalErreurs !== null ? String(totalErreurs) : isOlderThan24h ? '0' : 'E'
  const erreurClassName =
    erreurLabel === 'E'
      ? 'border-gray-200 text-gray-500'
      : totalErreurs && totalErreurs > 0
        ? 'border-orange-200 text-orange-600'
        : 'border-gray-200 text-gray-300'

  const corrections = e.correction_tentative ?? []
  const correctionReussie = corrections.find((c) => c.statut === 'succes') ?? null
  const correctionsEchouees = corrections.filter((c) => c.statut === 'echec').length

  const isActive = enCours || correctionEnCours

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

  async function handleCommencerCorrection() {
    setLoading(true)
    setError(null)
    const { error } = await supabase
      .from('correction_tentative')
      .insert({ entrainement_id: e.id, statut: 'en_cours', date_creation: todayISO() })
    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  async function handleTerminerCorrection(statut: 'succes' | 'echec') {
    const correctionActive = corrections.find((c) => c.statut === 'en_cours')
    if (!correctionActive) return
    setLoading(true)
    setError(null)
    const { error } = await supabase
      .from('correction_tentative')
      .update({ statut, updated_at: new Date().toISOString() })
      .eq('id', correctionActive.id)
    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div
      className={`rounded-xl border bg-white space-y-0 overflow-hidden ${
        enCours
          ? 'border-black shadow-sm'
          : correctionEnCours
            ? 'border-purple-400 shadow-sm'
            : 'border-gray-200'
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowErreurs(true)}
              className={`text-xs px-2 py-1 rounded border hover:border-gray-400 hover:text-gray-700 transition-colors ${erreurClassName}`}
            >
              {erreurLabel}
            </button>

            {/* Badge / bouton correction */}
            {correctionEnCours && (
              <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-medium text-white">
                C
              </span>
            )}
            {!correctionEnCours && !correctionReussie && correctionsEchouees > 0 && (
              <button
                onClick={canStartCorrection ? handleCommencerCorrection : undefined}
                disabled={loading || !canStartCorrection}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  canStartCorrection
                    ? 'border-purple-300 text-purple-600 hover:border-purple-500 hover:text-purple-800'
                    : 'border-purple-200 text-purple-400 cursor-default'
                }`}
              >
                C={correctionsEchouees}
              </button>
            )}
            {!correctionEnCours && !correctionReussie && correctionsEchouees === 0 && canStartCorrection && etat === 'echec' && (
              <button
                onClick={handleCommencerCorrection}
                disabled={loading}
                className="text-xs px-2 py-1 rounded border border-purple-300 text-purple-600 hover:border-purple-500 hover:text-purple-800 transition-colors disabled:opacity-50"
              >
                C
              </button>
            )}

            {enCours && (
              <span className="rounded-full bg-black px-2.5 py-0.5 text-xs font-medium text-white">
                En cours
              </span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          {correctionReussie ? (
            <span className="rounded-full px-2.5 py-0.5 font-medium bg-purple-100 text-purple-700">
              Corrigé ({corrections.length} tentative{corrections.length > 1 ? 's' : ''})
            </span>
          ) : (
            etat && (
              <span
                className={`rounded-full px-2.5 py-0.5 font-medium ${ETAT_STYLE[etat] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {ETAT_LABEL[etat] ?? etat}
              </span>
            )
          )}
          {tempsTotal > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">
              {formatTemps(tempsTotal)}
            </span>
          )}
        </div>

        {/* Actions — entraînement en cours OU correction en cours */}
        {isActive && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => toggleAction('session')}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                activeAction === 'session'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              + Session
            </button>
            <button
              onClick={() => toggleAction('terminer')}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                activeAction === 'terminer'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              Terminer
            </button>
            {correction?.pdf_url && (
              <button
                onClick={() => router.push(`/viewer?url=${encodeURIComponent(correction.pdf_url)}`)}
                title="Voir la correction PDF"
                className="flex items-center gap-1.5 text-sm px-3 py-3 rounded-xl border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 active:bg-gray-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Correction
              </button>
            )}
          </div>
        )}
      </div>

      {/* Panneau inline — Ajouter une session */}
      {isActive && activeAction === 'session' && (
        <form
          onSubmit={handleAjouterSession}
          className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-black text-left"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-black text-left"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto rounded-xl bg-black px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 active:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      )}

      {/* Panneau inline — Terminer */}
      {isActive && activeAction === 'terminer' && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
          <p className="text-xs font-medium text-gray-600">
            {correctionEnCours
              ? 'Comment s\'est passée cette correction ?'
              : 'Comment s\'est passé cet entraînement ?'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => correctionEnCours ? handleTerminerCorrection('succes') : handleTerminer('succes')}
              disabled={loading}
              className="flex-1 rounded-xl bg-green-600 py-4 text-base font-medium text-white hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
            >
              Succès
            </button>
            <button
              onClick={() => correctionEnCours ? handleTerminerCorrection('echec') : handleTerminer('echec')}
              disabled={loading}
              className="flex-1 rounded-xl bg-red-600 py-4 text-base font-medium text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors"
            >
              Échec
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {showErreurs && (
        <ErreurModal
          entrainementId={e.id}
          onClose={() => setShowErreurs(false)}
        />
      )}
    </div>
  )
}
