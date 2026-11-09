'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import FeuillePicker from './FeuillePicker'
import {
  btnDanger,
  btnPrimaire,
  btnSecondaire,
  champ,
  cheminFeuille,
  etiquette,
  type Accompagnement,
  type Etape,
  type FeuilleChoix,
} from './parcoursObjectifTypes'

const CHAOTIQUE_TEXTE = '#B8472A'
const CHAOTIQUE_FOND = '#FDEEE9'
const RYTHME_DEFAUT = 5

type Valeurs = { feuille_id: string; rythme: number; exo_debut: number | null; exo_fin: number | null }

// Feuilles chaotiques d'un parcours (table parcours_accompagnement) :
// rattachées sans être des étapes, un problème devient de temps en temps la
// prochaine action (« 1 problème sur N », lib/parcours/accompagnement.ts).
// Une feuille ne peut pas être à la fois étape et feuille chaotique du même
// parcours. Écritures : ajout avec le parcoursId affiché, le reste par l'id
// de la ligne affichée.
export default function ParcoursAccompagnement({
  parcoursId,
  accompagnements,
  etapes,
  feuilles,
  feuillesChaotiques,
  feuilleParId,
  onChange,
}: {
  parcoursId: string
  // Feuilles chaotiques de ce parcours, triées par ordre.
  accompagnements: Accompagnement[]
  etapes: Etape[]
  feuilles: FeuilleChoix[]
  // Descendantes de « Problèmes Chaotiques » (filtre par défaut du choix).
  feuillesChaotiques: FeuilleChoix[]
  feuilleParId: Map<string, FeuilleChoix>
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  // 'nouvelle' : formulaire d'ajout ; sinon id de la ligne modifiée.
  const [formulaire, setFormulaire] = useState<'nouvelle' | string | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const liste = accompagnements.slice().sort((a, b) => a.ordre - b.ordre)
  const feuillesEtapes = new Set(etapes.map((e) => e.feuille_id).filter((f): f is string => !!f))

  async function executer(action: () => Promise<{ error: { message: string } | null }>) {
    setEnCours(true)
    setErreur(null)
    const { error } = await action()
    if (error) {
      console.error('[admin feuilles chaotiques]', error)
      setErreur(error.message)
    }
    await onChange()
    setEnCours(false)
    return !error
  }

  async function enregistrer(v: Valeurs, ligne: Accompagnement | null) {
    const ok = await executer(async () => {
      if (ligne) {
        return supabase
          .from('parcours_accompagnement')
          .update({ rythme: v.rythme, exo_debut: v.exo_debut, exo_fin: v.exo_fin })
          .eq('id', ligne.id)
      }
      const ordre = liste.reduce((m, a) => Math.max(m, a.ordre), 0) + 1
      return supabase.from('parcours_accompagnement').insert({ ...v, parcours_id: parcoursId, ordre })
    })
    if (ok) setFormulaire(null)
  }

  // Échange les ordres de deux lignes voisines.
  async function deplacer(index: number, sens: -1 | 1) {
    const a = liste[index]
    const b = liste[index + sens]
    if (!a || !b) return
    const ordreA = a.ordre === b.ordre ? a.ordre + sens : b.ordre
    await executer(async () => {
      const r1 = await supabase.from('parcours_accompagnement').update({ ordre: ordreA }).eq('id', a.id)
      if (r1.error) return r1
      return supabase.from('parcours_accompagnement').update({ ordre: a.ordre }).eq('id', b.id)
    })
  }

  async function retirer(id: string) {
    const ok = await executer(async () => supabase.from('parcours_accompagnement').delete().eq('id', id))
    if (ok) setARetirer(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Feuilles chaotiques</h3>
          <p className="text-xs text-text-muted">En parallèle des étapes : un problème de temps en temps, selon le rythme.</p>
        </div>
        <button
          type="button"
          onClick={() => { setARetirer(null); setFormulaire('nouvelle') }}
          className={btnPrimaire}
          disabled={enCours}
        >
          + Feuille chaotique
        </button>
      </div>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {formulaire === 'nouvelle' && (
        <FormulaireChaotique
          key="nouvelle"
          initial={null}
          feuilles={feuilles}
          feuillesChaotiques={feuillesChaotiques}
          feuilleParId={feuilleParId}
          feuillesEtapes={feuillesEtapes}
          dejaChaotiques={new Set(liste.map((a) => a.feuille_id))}
          enCours={enCours}
          onAnnuler={() => setFormulaire(null)}
          onEnregistrer={(v) => enregistrer(v, null)}
        />
      )}

      {liste.length === 0 && formulaire !== 'nouvelle' && (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          Aucune feuille chaotique.
        </p>
      )}

      <ol className="space-y-2">
        {liste.map((a, i) => {
          const feuille = feuilleParId.get(a.feuille_id)
          if (formulaire === a.id) {
            return (
              <li key={a.id}>
                <FormulaireChaotique
                  key={a.id}
                  initial={a}
                  feuilles={feuilles}
                  feuillesChaotiques={feuillesChaotiques}
                  feuilleParId={feuilleParId}
                  feuillesEtapes={feuillesEtapes}
                  dejaChaotiques={new Set()}
                  enCours={enCours}
                  onAnnuler={() => setFormulaire(null)}
                  onEnregistrer={(v) => enregistrer(v, a)}
                />
              </li>
            )
          }
          const plage =
            a.exo_debut == null && a.exo_fin == null
              ? feuille?.volume
                ? `toute la feuille · ${feuille.volume} problèmes`
                : 'toute la feuille'
              : `problèmes ${a.exo_debut ?? 1} à ${a.exo_fin ?? feuille?.volume ?? '?'}`
          return (
            <li key={a.id} className="rounded-xl border p-3" style={{ background: '#FFFFFF' }}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-text-primary">{feuille?.titre ?? 'Feuille introuvable'}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{ color: CHAOTIQUE_TEXTE, background: CHAOTIQUE_FOND }}
                    >
                      1 problème sur {a.rythme}
                    </span>
                    {plage}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => deplacer(i, -1)}
                    disabled={enCours || i === 0}
                    aria-label="Monter la feuille"
                    className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => deplacer(i, 1)}
                    disabled={enCours || i === liste.length - 1}
                    aria-label="Descendre la feuille"
                    className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => { setARetirer(null); setFormulaire(a.id) }}
                    disabled={enCours}
                    className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormulaire(null); setARetirer(a.id) }}
                    disabled={enCours}
                    className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50"
                  >
                    Retirer
                  </button>
                </div>
              </div>

              {aRetirer === a.id && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm text-text-primary">Retirer cette feuille chaotique du parcours ?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setARetirer(null)} className={btnSecondaire} disabled={enCours}>
                      Annuler
                    </button>
                    <button type="button" onClick={() => retirer(a.id)} className={btnDanger} disabled={enCours}>
                      Retirer
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// Ajout (choix de la feuille, rythme, plage) ou modification (rythme, plage ;
// la feuille ne change pas : retirer puis ajouter).
function FormulaireChaotique({
  initial,
  feuilles,
  feuillesChaotiques,
  feuilleParId,
  feuillesEtapes,
  dejaChaotiques,
  enCours,
  onAnnuler,
  onEnregistrer,
}: {
  initial: Accompagnement | null
  feuilles: FeuilleChoix[]
  feuillesChaotiques: FeuilleChoix[]
  feuilleParId: Map<string, FeuilleChoix>
  // Feuilles des étapes de ce parcours (interdites).
  feuillesEtapes: Set<string>
  // Feuilles déjà chaotiques dans ce parcours (interdites à l'ajout).
  dejaChaotiques: Set<string>
  enCours: boolean
  onAnnuler: () => void
  onEnregistrer: (v: Valeurs) => void
}) {
  const [feuilleId, setFeuilleId] = useState<string | null>(initial?.feuille_id ?? null)
  const [seulementChaotiques, setSeulementChaotiques] = useState(true)
  const [rythme, setRythme] = useState(String(initial?.rythme ?? RYTHME_DEFAUT))
  const [debut, setDebut] = useState(initial?.exo_debut?.toString() ?? '')
  const [fin, setFin] = useState(initial?.exo_fin?.toString() ?? '')
  const [erreur, setErreur] = useState<string | null>(null)

  const feuille = feuilleId ? feuilleParId.get(feuilleId) ?? null : null
  const volume = feuille?.volume ?? 0
  const numeros = Array.from({ length: volume }, (_, i) => i + 1)

  function choisir(f: FeuilleChoix) {
    setErreur(null)
    if (feuillesEtapes.has(f.id)) {
      setErreur(`« ${f.titre} » est déjà une étape de ce parcours : elle ne peut pas être aussi une feuille chaotique.`)
      return
    }
    if (dejaChaotiques.has(f.id)) {
      setErreur(`« ${f.titre} » est déjà une feuille chaotique de ce parcours.`)
      return
    }
    if (f.id !== feuilleId) {
      setDebut('')
      setFin('')
    }
    setFeuilleId(f.id)
  }

  function valider() {
    setErreur(null)
    if (!feuilleId) return setErreur('Choisis une feuille.')
    if (!initial && feuillesEtapes.has(feuilleId)) return setErreur('Cette feuille est déjà une étape de ce parcours.')
    const n = Number(rythme)
    if (!Number.isInteger(n) || n < 2) return setErreur('Le rythme doit être un nombre entier d’au moins 2.')
    let d: number | null = debut ? parseInt(debut, 10) : null
    let f: number | null = fin ? parseInt(fin, 10) : null
    if (d != null || f != null) {
      d = d ?? 1
      f = f ?? (volume || d)
      if (d > f) return setErreur('Le premier problème doit précéder le dernier.')
    }
    onEnregistrer({ feuille_id: feuilleId, rythme: n, exo_debut: d, exo_fin: f })
  }

  return (
    <div className="space-y-4 rounded-xl border p-4" style={{ background: '#FFFFFF', borderColor: '#F5C9BB' }}>
      <p className="text-sm font-semibold text-text-primary">
        {initial ? 'Modifier la feuille chaotique' : 'Nouvelle feuille chaotique'}
      </p>

      <div className="space-y-1">
        <p className={etiquette}>Feuille</p>
        {initial || feuille ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <div>
              <p className="text-sm text-text-primary">{feuille?.titre ?? 'Feuille introuvable'}</p>
              {feuille && (
                <p className="text-xs text-text-muted">
                  {cheminFeuille(feuille) || 'Sans catégorie'} · {volume} problèmes
                </p>
              )}
            </div>
            {!initial && (
              <button type="button" onClick={() => setFeuilleId(null)} className={btnSecondaire}>
                Changer
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={seulementChaotiques}
                onChange={(e) => setSeulementChaotiques(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              « Problèmes Chaotiques » seulement (décocher pour toute la bibliothèque)
            </label>
            <FeuillePicker
              feuilles={seulementChaotiques ? feuillesChaotiques : feuilles}
              selectionId={feuilleId}
              onChoisir={choisir}
            />
          </div>
        )}
      </div>

      <label className="block space-y-1 sm:max-w-xs">
        <span className={etiquette}>Rythme</span>
        <span className="flex items-center gap-2 text-sm text-text-primary">
          1 problème sur
          <input
            type="number"
            min={2}
            step={1}
            value={rythme}
            onChange={(e) => setRythme(e.target.value)}
            className={`${champ} w-20`}
          />
        </span>
      </label>

      {feuille && (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={etiquette}>Du problème</span>
            <select value={debut} onChange={(e) => setDebut(e.target.value)} className={champ}>
              <option value="">Début de la feuille</option>
              {numeros.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={etiquette}>Au problème</span>
            <select value={fin} onChange={(e) => setFin(e.target.value)} className={champ}>
              <option value="">Fin de la feuille</option>
              {numeros.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAnnuler} className={btnSecondaire} disabled={enCours}>
          Annuler
        </button>
        <button type="button" onClick={valider} className={btnPrimaire} disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
