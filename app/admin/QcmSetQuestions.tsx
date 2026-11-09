'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QcmTexte from '../components/QcmTexte'
import QcmPositionnementForm, { type ValeursQcm } from './QcmPositionnementForm'
import { btnDanger, btnSecondaire, type QcmPositionnement, type QcmSet } from './parcoursObjectifTypes'

type Formulaire = { question: QcmPositionnement | null }

// Questions d'un set du test de positionnement (onglet QCM) : ajout,
// modification, actif, ordre ↑ ↓, suppression confirmée dans la page.
// Seules les questions actives comptent (lib/parcours/positionnement.ts).
// Écritures : un ajout prend le set_id et le feuille_id du set affiché, ordre
// = max du set + 1 ; les autres écritures, l'id de la question affichée.
export default function QcmSetQuestions({
  set,
  questions,
  onChange,
}: {
  set: QcmSet
  // Toutes les questions du set (actives ou non), triées par ordre.
  questions: QcmPositionnement[]
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const chapitres = Array.from(new Set(questions.map((q) => q.chapitre).filter((c): c is string => !!c)))

  async function executer(action: () => Promise<{ error: { message: string } | null }>) {
    setEnCours(true)
    setErreur(null)
    const { error } = await action()
    if (error) {
      console.error('[admin qcm]', error)
      setErreur(error.message)
    }
    await onChange()
    setEnCours(false)
    return !error
  }

  async function enregistrer(v: ValeursQcm) {
    const question = formulaire?.question
    const ok = await executer(async () => {
      if (question) return supabase.from('qcm_positionnement').update(v).eq('id', question.id)
      // Ordre max du set (questions actives et inactives) + 1.
      const ordre = questions.reduce((m, q) => Math.max(m, q.ordre), 0) + 1
      return supabase
        .from('qcm_positionnement')
        .insert({ ...v, set_id: set.id, feuille_id: set.feuille_id, ordre, actif: true })
    })
    if (ok) setFormulaire(null)
  }

  async function basculerActif(q: QcmPositionnement) {
    await executer(async () => supabase.from('qcm_positionnement').update({ actif: !q.actif }).eq('id', q.id))
  }

  // Échange les ordres de deux questions voisines du set.
  async function deplacer(index: number, sens: -1 | 1) {
    const a = questions[index]
    const b = questions[index + sens]
    if (!a || !b) return
    const ordreA = a.ordre === b.ordre ? a.ordre + sens : b.ordre
    await executer(async () => {
      const r1 = await supabase.from('qcm_positionnement').update({ ordre: ordreA }).eq('id', a.id)
      if (r1.error) return r1
      return supabase.from('qcm_positionnement').update({ ordre: a.ordre }).eq('id', b.id)
    })
  }

  async function supprimer(id: string) {
    const ok = await executer(async () => supabase.from('qcm_positionnement').delete().eq('id', id))
    if (ok) setASupprimer(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          {questions.length} question{questions.length > 1 ? 's' : ''} dans le set
        </p>
        <button
          type="button"
          onClick={() => { setASupprimer(null); setFormulaire({ question: null }) }}
          disabled={enCours}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-40"
        >
          + Question
        </button>
      </div>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {formulaire && !formulaire.question && (
        <QcmPositionnementForm
          key={`nouvelle-${set.id}`}
          initial={null}
          chapitres={chapitres}
          enCours={enCours}
          onAnnuler={() => setFormulaire(null)}
          onEnregistrer={enregistrer}
        />
      )}

      {questions.length > 0 && (
        <ul className="space-y-1">
          {questions.map((q, i) => {
            // En-tête de chapitre au début de chaque groupe de questions
            // consécutives du même chapitre.
            const precedent = i > 0 ? questions[i - 1].chapitre : null
            const enTeteChapitre =
              i === 0 ? q.chapitre : q.chapitre !== precedent ? q.chapitre ?? 'Sans chapitre' : null

            if (formulaire?.question?.id === q.id) {
              return (
                <li key={q.id}>
                  <QcmPositionnementForm
                    key={q.id}
                    initial={q}
                    chapitres={chapitres}
                    enCours={enCours}
                    onAnnuler={() => setFormulaire(null)}
                    onEnregistrer={enregistrer}
                  />
                </li>
              )
            }

            return (
              <li key={q.id} className="space-y-1">
                {enTeteChapitre && (
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {enTeteChapitre}
                  </p>
                )}
                <div className={`rounded-lg border border-border bg-surface px-3 py-2 ${q.actif ? '' : 'opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="line-clamp-2 min-w-0 flex-1 text-sm text-text-primary">
                      <QcmTexte text={q.enonce} compact />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={q.actif}
                        aria-label={q.actif ? 'Désactiver la question' : 'Activer la question'}
                        title={q.actif ? 'Active' : 'Inactive'}
                        onClick={() => basculerActif(q)}
                        disabled={enCours}
                        className="px-1 py-1 disabled:opacity-50"
                      >
                        <span
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                            q.actif ? 'bg-accent' : 'bg-border-strong'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                              q.actif ? 'translate-x-3.5' : 'translate-x-0.5'
                            }`}
                          />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacer(i, -1)}
                        disabled={enCours || i === 0}
                        aria-label="Monter la question"
                        className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacer(i, 1)}
                        disabled={enCours || i === questions.length - 1}
                        aria-label="Descendre la question"
                        className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => { setASupprimer(null); setFormulaire({ question: q }) }}
                        disabled={enCours}
                        className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormulaire(null); setASupprimer(q.id) }}
                        disabled={enCours}
                        className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {aSupprimer === q.id && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-sm text-text-primary">
                        Supprimer cette question ? Elle disparaît du test de tous les objectifs qui utilisent ce set.
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setASupprimer(null)} className={btnSecondaire} disabled={enCours}>
                          Annuler
                        </button>
                        <button type="button" onClick={() => supprimer(q.id)} className={btnDanger} disabled={enCours}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
