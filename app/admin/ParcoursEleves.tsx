'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  btnDanger,
  btnPrimaire,
  btnSecondaire,
  champ,
  etiquette,
  nomEleve,
  type Assignation,
  type EleveParcours,
  type Etape,
  type FeuilleChoix,
  type Parcours,
} from './parcoursObjectifTypes'

type Saisie = { eleve: EleveParcours; date: string }

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function formatDate(d: string | null): string {
  if (!d) return 'sans date'
  const date = new Date(`${d}T00:00:00`)
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Élèves assignés au parcours, assignation (un parcours par élève : upsert
// sur parcours_eleve.user_id), modification et retrait. Première assignation
// ou changement de parcours : created_at repart de maintenant et le test de
// positionnement est remis à zéro ; une simple modification de la date
// d'examen ne touche à rien d'autre. Départ du test affiché par élève, avec
// réinitialisation (etape_depart_id et positionnement_at à null).
export default function ParcoursEleves({
  parcours,
  eleves,
  assignations,
  parcoursParId,
  etapes,
  feuilleParId,
  onChange,
}: {
  parcours: Parcours
  eleves: EleveParcours[]
  assignations: Assignation[]
  parcoursParId: Map<string, Parcours>
  // Étapes du parcours affiché, pour le titre de l'étape de départ.
  etapes: Etape[]
  feuilleParId: Map<string, FeuilleChoix>
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  const [formOuvert, setFormOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [saisie, setSaisie] = useState<Saisie | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
  const [aReinitialiser, setAReinitialiser] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const eleveParId = useMemo(() => new Map(eleves.map((e) => [e.id, e])), [eleves])
  const assignationParEleve = useMemo(() => new Map(assignations.map((a) => [a.user_id, a])), [assignations])

  const assignes = assignations
    .filter((a) => a.parcours_id === parcours.id)
    .map((a) => ({ a, eleve: eleveParId.get(a.user_id) }))
    .sort((x, y) => norm(x.eleve?.pseudo).localeCompare(norm(y.eleve?.pseudo)))

  const resultats = useMemo(() => {
    const q = norm(recherche)
    if (!q) return []
    return eleves.filter((e) => norm(e.pseudo).includes(q)).slice(0, 8)
  }, [eleves, recherche])

  function fermer() {
    setFormOuvert(false)
    setRecherche('')
    setSaisie(null)
    setErreur(null)
  }

  function choisirEleve(eleve: EleveParcours) {
    const existante = assignationParEleve.get(eleve.id)
    const memeParcours = existante?.parcours_id === parcours.id
    setSaisie({ eleve, date: memeParcours ? existante.date_objectif ?? '' : '' })
    setRecherche('')
  }

  function modifier(a: Assignation) {
    const eleve = eleveParId.get(a.user_id)
    if (!eleve) return
    setARetirer(null)
    setFormOuvert(true)
    choisirEleve(eleve)
  }

  async function executer(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setEnCours(true)
    setErreur(null)
    const { error } = await action()
    if (error) {
      console.error('[admin objectifs] élèves', error)
      setErreur(error.message)
    }
    await onChange()
    setEnCours(false)
    return !error
  }

  async function enregistrer() {
    if (!saisie) return
    const maintenant = new Date().toISOString()
    const memeParcours = assignationParEleve.get(saisie.eleve.id)?.parcours_id === parcours.id
    const ok = await executer(() =>
      supabase.from('parcours_eleve').upsert(
        {
          user_id: saisie.eleve.id,
          parcours_id: parcours.id,
          date_objectif: saisie.date || null,
          updated_at: maintenant,
          // Nouvelle assignation : repart de zéro (règle des étapes ajoutées
          // après coup, test de positionnement).
          ...(memeParcours ? {} : { created_at: maintenant, etape_depart_id: null, positionnement_at: null }),
        },
        { onConflict: 'user_id' }
      )
    )
    if (ok) fermer()
  }

  // Remet le test de positionnement de l'élève affiché à zéro, seulement
  // s'il est toujours sur le parcours affiché.
  async function reinitialiserTest(userId: string) {
    const ok = await executer(() =>
      supabase
        .from('parcours_eleve')
        .update({ etape_depart_id: null, positionnement_at: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('parcours_id', parcours.id)
    )
    if (ok) setAReinitialiser(null)
  }

  function libelleDepart(a: Assignation): string {
    if (!a.positionnement_at) return 'Test non passé'
    const etape = a.etape_depart_id ? etapes.find((e) => e.id === a.etape_depart_id) : undefined
    if (!etape) return 'Test passé sans départ (début)'
    const titre =
      etape.type === 'examen'
        ? etape.libelle ?? 'Examen'
        : (etape.feuille_id ? feuilleParId.get(etape.feuille_id)?.titre : null) ?? 'Feuille introuvable'
    const date = new Date(a.positionnement_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    return `Départ : ${titre} · test du ${date}`
  }

  async function retirer(userId: string) {
    const ok = await executer(() => supabase.from('parcours_eleve').delete().eq('user_id', userId))
    if (ok) setARetirer(null)
  }

  const autreParcours = (() => {
    if (!saisie) return null
    const a = assignationParEleve.get(saisie.eleve.id)
    if (!a || a.parcours_id === parcours.id) return null
    return parcoursParId.get(a.parcours_id)?.nom ?? 'un autre parcours'
  })()

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text-primary">
          Élèves <span className="font-normal text-text-muted">· {assignes.length}</span>
        </h3>
        {!formOuvert && (
          <button type="button" onClick={() => setFormOuvert(true)} className={btnPrimaire}>
            Assigner un élève
          </button>
        )}
      </div>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {formOuvert && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          {!saisie ? (
            <div className="space-y-2">
              <label className="space-y-1 block">
                <span className={etiquette}>Pseudo de l’élève</span>
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher par pseudo…"
                  className={champ}
                  autoFocus
                />
              </label>
              {recherche.trim() && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {resultats.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">Aucun élève.</li>}
                  {resultats.map((e) => {
                    const a = assignationParEleve.get(e.id)
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => choisirEleve(e)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2"
                        >
                          <span className="text-sm text-text-primary">{nomEleve(e)}</span>
                          {a && (
                            <span className="text-xs text-text-muted">{parcoursParId.get(a.parcours_id)?.nom ?? 'parcours'}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-text-primary">{nomEleve(saisie.eleve)}</p>
                <button type="button" onClick={() => setSaisie(null)} className={btnSecondaire} disabled={enCours}>
                  Changer
                </button>
              </div>

              {autreParcours && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-warning">
                  Cet élève suit actuellement « {autreParcours} ». L’enregistrement remplacera ce parcours.
                </p>
              )}

              <label className="block space-y-1 sm:max-w-xs">
                <span className={etiquette}>Date de l’examen final</span>
                <input
                  type="date"
                  value={saisie.date}
                  onChange={(e) => setSaisie({ ...saisie, date: e.target.value })}
                  className={champ}
                />
              </label>
            </>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={fermer} className={btnSecondaire} disabled={enCours}>
              Annuler
            </button>
            {saisie && (
              <button type="button" onClick={enregistrer} className={btnPrimaire} disabled={enCours}>
                {enCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      )}

      {assignes.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun élève sur ce parcours.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {assignes.map(({ a, eleve }) => {
            return (
              <li key={a.user_id} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{eleve ? nomEleve(eleve) : a.user_id}</p>
                    <p className="text-xs text-text-muted">Examen : {formatDate(a.date_objectif)}</p>
                    <p className="text-xs text-text-muted">{libelleDepart(a)}</p>
                  </div>
                  <div className="flex gap-1">
                    {a.positionnement_at && (
                      <button
                        type="button"
                        onClick={() => { setARetirer(null); setAReinitialiser(a.user_id) }}
                        disabled={enCours}
                        className="rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2"
                      >
                        Réinitialiser le test
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => modifier(a)}
                      disabled={enCours || !eleve}
                      className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAReinitialiser(null); setARetirer(a.user_id) }}
                      disabled={enCours}
                      className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
                {aReinitialiser === a.user_id && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-sm text-text-primary">
                      Réinitialiser le test ? L’élève repartira du début du parcours.
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAReinitialiser(null)} className={btnSecondaire} disabled={enCours}>
                        Annuler
                      </button>
                      <button type="button" onClick={() => reinitialiserTest(a.user_id)} className={btnPrimaire} disabled={enCours}>
                        Réinitialiser
                      </button>
                    </div>
                  </div>
                )}
                {aRetirer === a.user_id && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-sm text-text-primary">Retirer cet élève du parcours ?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setARetirer(null)} className={btnSecondaire} disabled={enCours}>
                        Annuler
                      </button>
                      <button type="button" onClick={() => retirer(a.user_id)} className={btnDanger} disabled={enCours}>
                        Retirer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
