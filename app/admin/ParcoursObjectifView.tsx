'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ParcoursEtapes from './ParcoursEtapes'
import ParcoursEleves from './ParcoursEleves'
import ParcoursPositionnement from './ParcoursPositionnement'
import type { Noeud } from './AdminClient'
import {
  btnPrimaire,
  btnSecondaire,
  champ,
  COLONNES_QCM,
  descendDe,
  etiquette,
  NOEUD_PREPARATION_EXAMEN,
  type Assignation,
  type EleveParcours,
  type Etape,
  type FeuilleChoix,
  type Parcours,
  type Positionnement,
} from './parcoursObjectifTypes'

// Onglet admin « Objectifs » : parcours (objectifs), leurs étapes et les
// élèves assignés. Tables parcours, parcours_etape, parcours_eleve et
// parcours_positionnement (questions du test de positionnement).
export default function ParcoursObjectifView({
  noeuds,
  feuilles,
  eleves,
}: {
  noeuds: Noeud[]
  feuilles: FeuilleChoix[]
  eleves: EleveParcours[]
}) {
  const supabase = createClient()
  const [parcours, setParcours] = useState<Parcours[] | null>(null)
  const [etapes, setEtapes] = useState<Etape[]>([])
  const [assignations, setAssignations] = useState<Assignation[]>([])
  const [positionnements, setPositionnements] = useState<Positionnement[]>([])
  const [selectionId, setSelectionId] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)

  const charger = useCallback(async () => {
    const [p, e, a, q] = await Promise.all([
      supabase.from('parcours').select('id, nom, description, ordre, actif, created_at').order('ordre').order('created_at'),
      supabase
        .from('parcours_etape')
        .select('id, parcours_id, ordre, type, feuille_id, exo_debut, exo_fin, libelle')
        .order('ordre'),
      supabase.from('parcours_eleve').select('user_id, parcours_id, date_objectif'),
      supabase
        .from('parcours_positionnement')
        .select(`id, parcours_id, etape_id, qcm_question_id, ordre, question:qcm_question(${COLONNES_QCM})`)
        .order('ordre'),
    ])
    const err = p.error ?? e.error ?? a.error ?? q.error
    if (err) {
      console.error('[admin objectifs] chargement', err)
      setErreur(err.message)
    } else {
      setErreur(null)
    }
    setParcours((p.data ?? []) as Parcours[])
    setEtapes((e.data ?? []) as Etape[])
    setAssignations((a.data ?? []) as Assignation[])
    setPositionnements((q.data ?? []) as unknown as Positionnement[])
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const feuilleParId = useMemo(() => new Map(feuilles.map((f) => [f.id, f])), [feuilles])
  // Feuilles possibles pour une étape examen : descendantes de « Préparation Examen ».
  const feuillesExamen = useMemo(() => {
    const parentParId = new Map(noeuds.map((n) => [n.id, n.parent_id]))
    return feuilles.filter((f) => descendDe(f.noeud?.id, NOEUD_PREPARATION_EXAMEN, parentParId))
  }, [noeuds, feuilles])
  const parcoursParId = useMemo(() => new Map((parcours ?? []).map((p) => [p.id, p])), [parcours])

  const etapesParParcours = useMemo(() => {
    const m = new Map<string, Etape[]>()
    for (const e of etapes) {
      if (!m.has(e.parcours_id)) m.set(e.parcours_id, [])
      m.get(e.parcours_id)!.push(e)
    }
    for (const liste of Array.from(m.values())) liste.sort((x, y) => x.ordre - y.ordre)
    return m
  }, [etapes])

  // Questions de positionnement par étape, triées par ordre.
  const positionnementsParEtape = useMemo(() => {
    const m = new Map<string, Positionnement[]>()
    for (const q of positionnements) {
      if (!m.has(q.etape_id)) m.set(q.etape_id, [])
      m.get(q.etape_id)!.push(q)
    }
    for (const liste of Array.from(m.values())) liste.sort((x, y) => x.ordre - y.ordre)
    return m
  }, [positionnements])

  const selection = selectionId ? parcoursParId.get(selectionId) ?? null : null

  async function creerParcours() {
    setCreation(true)
    const ordre = (parcours ?? []).reduce((m, p) => Math.max(m, p.ordre ?? 0), 0) + 1
    const { data, error } = await supabase
      .from('parcours')
      .insert({ nom: 'Nouveau parcours', actif: false, ordre })
      .select('id')
      .single()
    if (error) {
      console.error('[admin objectifs] création', error)
      setErreur(error.message)
    }
    await charger()
    if (data) setSelectionId(data.id)
    setCreation(false)
  }

  return (
    <div className="space-y-3">
      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        {/* Colonne gauche : liste des parcours */}
        <aside className="space-y-3 self-start rounded-2xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-bold text-text-primary">Objectifs</h2>
            <button type="button" onClick={creerParcours} disabled={creation} className={btnPrimaire}>
              + Parcours
            </button>
          </div>

          {!parcours ? (
            <p className="px-1 text-sm text-text-muted">Chargement…</p>
          ) : parcours.length === 0 ? (
            <p className="px-1 text-sm text-text-muted">Aucun parcours.</p>
          ) : (
            <ul className="space-y-1">
              {parcours.map((p) => {
                const nb = etapesParParcours.get(p.id)?.length ?? 0
                const actif = p.id === selectionId
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectionId(p.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                        actif ? 'bg-accent-soft' : 'hover:bg-surface-2'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm font-semibold ${actif ? 'text-accent' : 'text-text-primary'}`}>
                          {p.nom}
                        </span>
                        <PastilleStatut actif={p.actif} />
                      </span>
                      <span className="block text-xs text-text-muted">
                        {nb} étape{nb > 1 ? 's' : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Panneau droit : parcours sélectionné */}
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-5">
          {!selection ? (
            <p className="py-10 text-center text-sm text-text-muted">Sélectionne un parcours ou crées-en un.</p>
          ) : (
            // Une seule clé, sur le conteneur : au changement de parcours,
            // en-tête, étapes et élèves sont remontés ensemble (état local
            // réinitialisé, écritures sur le seul id sélectionné). Pas de clé
            // sur les enfants : trois frères avec la même clé faisaient perdre
            // à React la trace des anciens, laissés à l'écran avec leur parcours.
            <div key={selection.id} className="space-y-6">
              <EnTeteParcours parcours={selection} onChange={charger} onErreur={setErreur} />
              <ParcoursEtapes
                parcoursId={selection.id}
                etapes={etapesParParcours.get(selection.id) ?? []}
                feuilles={feuilles}
                feuillesExamen={feuillesExamen}
                feuilleParId={feuilleParId}
                positionnementsParEtape={positionnementsParEtape}
                onChange={charger}
              />
              <div className="border-t border-border pt-5">
                <ParcoursPositionnement
                  key={selection.id}
                  etapes={etapesParParcours.get(selection.id) ?? []}
                  feuilleParId={feuilleParId}
                  positionnementsParEtape={positionnementsParEtape}
                  onChange={charger}
                />
              </div>
              <div className="border-t border-border pt-5">
                <ParcoursEleves
                  parcours={selection}
                  eleves={eleves}
                  assignations={assignations}
                  parcoursParId={parcoursParId}
                  onChange={charger}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PastilleStatut({ actif }: { actif: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        actif ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-muted'
      }`}
    >
      {actif ? 'Actif' : 'Brouillon'}
    </span>
  )
}

// Nom, description (enregistrés à la demande) et interrupteur Actif
// (enregistré immédiatement).
function EnTeteParcours({
  parcours,
  onChange,
  onErreur,
}: {
  parcours: Parcours
  onChange: () => Promise<void>
  onErreur: (m: string | null) => void
}) {
  const supabase = createClient()
  const [nom, setNom] = useState(parcours.nom)
  const [description, setDescription] = useState(parcours.description ?? '')
  const [enCours, setEnCours] = useState(false)

  const modifie = nom.trim() !== parcours.nom || (description.trim() || null) !== (parcours.description ?? null)

  async function maj(champs: Partial<Pick<Parcours, 'nom' | 'description' | 'actif'>>) {
    setEnCours(true)
    const { error } = await supabase.from('parcours').update(champs).eq('id', parcours.id)
    if (error) console.error('[admin objectifs] mise à jour', error)
    onErreur(error ? error.message : null)
    await onChange()
    setEnCours(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="min-w-[220px] flex-1 space-y-1">
          <span className={etiquette}>Nom</span>
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
        </label>
        <div className="space-y-1">
          <span className={etiquette}>Statut</span>
          <button
            type="button"
            role="switch"
            aria-checked={parcours.actif}
            onClick={() => maj({ actif: !parcours.actif })}
            disabled={enCours}
            className="flex items-center gap-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
          >
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                parcours.actif ? 'bg-accent' : 'bg-border-strong'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  parcours.actif ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
            {parcours.actif ? 'Actif' : 'Brouillon'}
          </button>
        </div>
      </div>

      <label className="block space-y-1">
        <span className={etiquette}>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${champ} resize-y`}
          placeholder="Pour qui, dans quel but…"
        />
      </label>

      {modifie && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setNom(parcours.nom); setDescription(parcours.description ?? '') }}
            className={btnSecondaire}
            disabled={enCours}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => maj({ nom: nom.trim() || parcours.nom, description: description.trim() || null })}
            className={btnPrimaire}
            disabled={enCours || !nom.trim()}
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  )
}
