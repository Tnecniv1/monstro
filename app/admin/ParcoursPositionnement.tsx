'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QcmTexte from '../components/QcmTexte'
import QcmPositionnementForm, { type ValeursQcm } from './QcmPositionnementForm'
import { seuilFeuille } from '@/lib/parcours/positionnement'
import { btnDanger, btnSecondaire, type Etape, type FeuilleChoix, type QcmPositionnement } from './parcoursObjectifTypes'

const ORANGE_FOND = '#FFFBEB'
const ORANGE_BORD = '#FDE68A'
const SECONDES_PAR_QUESTION = 30
// En dessous, une feuille est signalée (avertissement seul).
const QUESTIONS_FIABLES = 6

function dureeEstimee(nbQuestions: number): string {
  const s = nbQuestions * SECONDES_PAR_QUESTION
  return s < 60 ? `environ ${s} s` : `environ ${Math.ceil(s / 60)} min`
}

type Formulaire = { etapeId: string; question: QcmPositionnement | null }

// Test de positionnement d'un parcours. Les questions (qcm_positionnement)
// sont rattachées à la FEUILLE : modifier celles d'une feuille change le test
// de tous les parcours qui la contiennent. Seules les questions actives
// comptent (lib/parcours/positionnement.ts) : une feuille est acquise à
// ceil(2n/3) justes ; le test s'arrête à la première feuille non acquise ;
// une feuille sans question active l'arrête forcément. Durée estimée : pire
// cas, toutes les questions actives posées.
// Écritures : un ajout prend le feuille_id de l'étape affichée ; les autres
// écritures, l'id de la question affichée.
export default function ParcoursPositionnement({
  etapes,
  feuilleParId,
  questionsParFeuille,
  parcoursParFeuille,
  onChange,
}: {
  etapes: Etape[]
  feuilleParId: Map<string, FeuilleChoix>
  // Toutes les questions (actives ou non) par feuille, triées par ordre.
  questionsParFeuille: Map<string, QcmPositionnement[]>
  // Noms des parcours qui contiennent chaque feuille.
  parcoursParFeuille: Map<string, string[]>
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const feuilles = etapes.filter((e) => e.type === 'feuille')
  const questionsDe = (e: Etape) => (e.feuille_id ? questionsParFeuille.get(e.feuille_id) ?? [] : [])
  const nbActives = (e: Etape) => questionsDe(e).filter((q) => q.actif).length
  const totalActives = feuilles.reduce((s, e) => s + nbActives(e), 0)
  const sansQuestion = feuilles.filter((e) => nbActives(e) === 0).length

  async function executer(action: () => Promise<{ error: { message: string } | null }>) {
    setEnCours(true)
    setErreur(null)
    const { error } = await action()
    if (error) {
      console.error('[admin positionnement]', error)
      setErreur(error.message)
    }
    await onChange()
    setEnCours(false)
    return !error
  }

  async function enregistrer(etape: Etape, v: ValeursQcm) {
    const question = formulaire?.question
    const ok = await executer(async () => {
      if (question) return supabase.from('qcm_positionnement').update(v).eq('id', question.id)
      if (!etape.feuille_id) return { error: { message: 'Étape sans feuille.' } }
      // Ordre max de la feuille (questions actives et inactives) + 1.
      const ordre = questionsDe(etape).reduce((m, q) => Math.max(m, q.ordre), 0) + 1
      return supabase.from('qcm_positionnement').insert({ ...v, feuille_id: etape.feuille_id, ordre, actif: true })
    })
    if (ok) setFormulaire(null)
  }

  async function basculerActif(q: QcmPositionnement) {
    await executer(async () => supabase.from('qcm_positionnement').update({ actif: !q.actif }).eq('id', q.id))
  }

  // Échange les ordres de deux questions voisines d'une même feuille.
  async function deplacer(questions: QcmPositionnement[], index: number, sens: -1 | 1) {
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-text-primary">Test de positionnement</h3>
        <p className="text-xs text-text-muted">
          {totalActives} question{totalActives > 1 ? 's' : ''} active{totalActives > 1 ? 's' : ''}
          {' · '}
          <span className={sansQuestion > 0 ? 'font-semibold text-warning' : ''}>
            {sansQuestion} feuille{sansQuestion > 1 ? 's' : ''} sans question
          </span>
          {totalActives > 0 && ` · ${dureeEstimee(totalActives)} au plus (toutes les questions)`}
        </p>
      </div>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {feuilles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          Aucune étape feuille dans ce parcours.
        </p>
      ) : (
        <ol className="space-y-2">
          {feuilles.map((etape) => {
            const feuille = etape.feuille_id ? feuilleParId.get(etape.feuille_id) : undefined
            const titre = feuille?.titre ?? 'Feuille introuvable'
            const questions = questionsDe(etape)
            const actives = nbActives(etape)
            const inactives = questions.length - actives
            const vide = actives === 0
            const peuFiable = !vide && actives < QUESTIONS_FIABLES
            const seuil = seuilFeuille(actives)
            const numero = etapes.indexOf(etape) + 1
            const parcoursAvecFeuille = etape.feuille_id ? parcoursParFeuille.get(etape.feuille_id) ?? [] : []
            const chapitres = Array.from(new Set(questions.map((q) => q.chapitre).filter((c): c is string => !!c)))
            const formulaireOuvert = formulaire?.etapeId === etape.id

            return (
              <li
                key={etape.id}
                className="space-y-2 rounded-xl border p-3"
                style={vide ? { background: ORANGE_FOND, borderColor: ORANGE_BORD } : { background: '#FFFFFF' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-text-primary">
                      <span className="text-text-muted">{numero}. </span>
                      {titre}
                    </p>
                    <p className={`text-xs ${vide ? 'font-semibold text-warning' : 'text-text-muted'}`}>
                      {vide
                        ? 'Aucune question active · le test s’arrêtera ici'
                        : `${actives} question${actives > 1 ? 's' : ''} active${actives > 1 ? 's' : ''} · acquise à ${seuil} juste${seuil > 1 ? 's' : ''}`}
                      {inactives > 0 && ` · ${inactives} inactive${inactives > 1 ? 's' : ''}`}
                    </p>
                    {peuFiable && (
                      <p className="text-xs font-semibold text-warning">Moins de 6 questions : le test sera moins fiable</p>
                    )}
                    {etape.feuille_id && (
                      <p className="text-xs text-text-muted">
                        Ces questions servent à tous les parcours qui contiennent cette feuille
                        {parcoursAvecFeuille.length > 0 && ` : ${parcoursAvecFeuille.join(', ')}`}
                      </p>
                    )}
                  </div>
                  {etape.feuille_id && (
                    <button
                      type="button"
                      onClick={() => { setASupprimer(null); setFormulaire({ etapeId: etape.id, question: null }) }}
                      disabled={enCours}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-40"
                    >
                      + Question
                    </button>
                  )}
                </div>

                {formulaireOuvert && !formulaire?.question && (
                  <QcmPositionnementForm
                    key={`nouvelle-${etape.id}`}
                    initial={null}
                    chapitres={chapitres}
                    enCours={enCours}
                    onAnnuler={() => setFormulaire(null)}
                    onEnregistrer={(v) => enregistrer(etape, v)}
                  />
                )}

                {questions.length > 0 && (
                  <ul className="space-y-1">
                    {questions.map((q, i) => {
                      // En-tête de chapitre au début de chaque groupe de
                      // questions consécutives du même chapitre.
                      const precedent = i > 0 ? questions[i - 1].chapitre : null
                      const enTeteChapitre =
                        i === 0 ? q.chapitre : q.chapitre !== precedent ? q.chapitre ?? 'Sans chapitre' : null

                      if (formulaireOuvert && formulaire?.question?.id === q.id) {
                        return (
                          <li key={q.id}>
                            <QcmPositionnementForm
                              key={q.id}
                              initial={q}
                              chapitres={chapitres}
                              enCours={enCours}
                              onAnnuler={() => setFormulaire(null)}
                              onEnregistrer={(v) => enregistrer(etape, v)}
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
                                  onClick={() => deplacer(questions, i, -1)}
                                  disabled={enCours || i === 0}
                                  aria-label="Monter la question"
                                  className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deplacer(questions, i, 1)}
                                  disabled={enCours || i === questions.length - 1}
                                  aria-label="Descendre la question"
                                  className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setASupprimer(null); setFormulaire({ etapeId: etape.id, question: q }) }}
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
                                  Supprimer cette question ? Elle disparaît du test de tous les parcours qui contiennent cette feuille.
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
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
