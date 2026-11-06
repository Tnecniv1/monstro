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
// sur parcours_eleve.user_id), modification et retrait. L'élève commence
// toujours à la première étape : etape_depart_id n'est pas envoyé.
export default function ParcoursEleves({
  parcours,
  eleves,
  assignations,
  parcoursParId,
  onChange,
}: {
  parcours: Parcours
  eleves: EleveParcours[]
  assignations: Assignation[]
  parcoursParId: Map<string, Parcours>
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  const [formOuvert, setFormOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [saisie, setSaisie] = useState<Saisie | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
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
    const ok = await executer(() =>
      supabase.from('parcours_eleve').upsert(
        {
          user_id: saisie.eleve.id,
          parcours_id: parcours.id,
          date_objectif: saisie.date || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    )
    if (ok) fermer()
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
                  </div>
                  <div className="flex gap-1">
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
                      onClick={() => setARetirer(a.user_id)}
                      disabled={enCours}
                      className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
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
