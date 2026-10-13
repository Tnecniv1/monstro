'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatHeure, jourParis } from './relativeTime'
import { ajouterJours, lundiDe } from './semaine'
import type { LiveSession } from './types'

const FIELD_CLASS =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'

interface Props {
  userId: string
  // Session à modifier, ou null pour une nouvelle session.
  session: LiveSession | null
  // Nouvelle session : date pré-remplie ('YYYY-MM-DD'), ou '' pour la laisser vide.
  dateInitiale: string
  // `date` : jour de la (première) session enregistrée, pour afficher sa semaine.
  onSaved: (message: string, date: string) => void
  onClose: () => void
}

// Date et heure saisies à l'heure de Paris : Postgres convertit lui-même
// ("2026-10-15 18:00:00 Europe/Paris" est une valeur timestamptz valide).
function debutParis(date: string, heure: string): string {
  return `${date} ${heure}:00 Europe/Paris`
}

function estPasse(date: string, heure: string): boolean {
  const maintenant = new Date().toISOString()
  return `${date} ${heure}` <= `${jourParis(maintenant)} ${formatHeure(maintenant)}`
}

// Modal admin : nouvelle session (une seule, ou la même du lundi au vendredi
// de la semaine choisie) ou modification d'une session existante.
export default function EquipeSessionModal({ userId, session, dateInitiale, onSaved, onClose }: Props) {
  const [date, setDate] = useState(session ? jourParis(session.debut) : dateInitiale)
  const [heure, setHeure] = useState(session ? formatHeure(session.debut) : '')
  const [places, setPlaces] = useState(session ? String(session.places) : '8')
  const [lien, setLien] = useState(session?.lien ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nbPlaces = Number(places)
  const complet = !!date && !!heure && Number.isInteger(nbPlaces) && nbPlaces > 0 && !!lien.trim()

  // Renvoie le message d'erreur, ou null si la saisie est valide.
  function verifier(): string | null {
    if (!/^https:\/\//.test(lien.trim())) return 'Le lien doit commencer par https://'
    if (session && nbPlaces < session.nb_inscrits) {
      return `Impossible de descendre sous le nombre d'inscrits (${session.nb_inscrits}).`
    }
    return null
  }

  async function enregistrer(jours: string[]) {
    // Un second clic pendant la requête ne crée pas de doublon.
    if (saving) return
    const invalide = verifier()
    if (invalide) {
      setError(invalide)
      return
    }
    // Modification : pas de contrôle, pour pouvoir corriger une session en cours.
    const aVenir = session ? jours : jours.filter((j) => !estPasse(j, heure))
    if (aVenir.length === 0) {
      setError(jours.length > 1 ? 'Tous les jours de cette semaine sont déjà passés.' : 'Cette date est déjà passée.')
      return
    }

    setSaving(true)
    setError(null)
    const supabase = createClient()
    const valeurs = { places: nbPlaces, lien: lien.trim() }
    const { error } = session
      ? await supabase
          .from('live_session')
          .update({ ...valeurs, debut: debutParis(aVenir[0], heure) })
          .eq('id', session.id)
      : await supabase
          .from('live_session')
          .insert(aVenir.map((j) => ({ ...valeurs, animateur_id: userId, debut: debutParis(j, heure) })))

    if (error) {
      setSaving(false)
      setError(error.message)
      return
    }
    // Pas de setSaving(false) : les boutons restent désactivés jusqu'à la fermeture.
    const ignores = jours.length - aVenir.length
    const pluriel = ignores > 1 ? 's' : ''
    onSaved(
      session
        ? 'Session modifiée.'
        : aVenir.length === 1
          ? 'Session créée.'
          : `${aVenir.length} sessions créées${ignores > 0 ? ` (${ignores} jour${pluriel} déjà passé${pluriel} ignoré${pluriel})` : ''}.`,
      aVenir[0],
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enregistrer([date])
        }}
        className="relative z-10 w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-text-primary">{session ? 'Modifier la session' : 'Nouvelle session'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-muted hover:text-text-secondary transition-colors text-2xl leading-none p-2 -mr-2"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={FIELD_CLASS} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Heure (Paris)</label>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} required className={FIELD_CLASS} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Places</label>
            <input
              type="number"
              min={1}
              step={1}
              value={places}
              onChange={(e) => setPlaces(e.target.value)}
              required
              className={FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Lien Meet</label>
            <input
              type="url"
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              required
              placeholder="https://meet.google.com/…"
              className={FIELD_CLASS}
            />
          </div>

          {!session && (
            <button
              type="button"
              onClick={() => enregistrer(Array.from({ length: 5 }, (_, i) => ajouterJours(lundiDe(date), i)))}
              disabled={!complet || saving}
              title="Crée la même session du lundi au vendredi de la semaine de la date choisie"
              className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              Dupliquer sur la semaine
            </button>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-text-secondary hover:bg-surface-2 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!complet || saving}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Enregistrement…' : session ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
