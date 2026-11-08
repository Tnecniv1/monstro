'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QcmTexte from '../components/QcmTexte'
import QcmPicker from './QcmPicker'
import {
  btnDanger,
  btnSecondaire,
  type Etape,
  type FeuilleChoix,
  type Positionnement,
  type QcmQuestion,
} from './parcoursObjectifTypes'

const ORANGE_FOND = '#FFFBEB'
const ORANGE_BORD = '#FDE68A'
const SECONDES_PAR_QUESTION = 30

function dureeEstimee(nbQuestions: number): string {
  const s = nbQuestions * SECONDES_PAR_QUESTION
  return s < 60 ? `environ ${s} s` : `environ ${Math.ceil(s / 60)} min`
}

// Test de positionnement d'un parcours : questions de la banque QCM
// rattachées à chaque étape feuille (table parcours_positionnement). Le test
// s'arrête à la première feuille non acquise ; une feuille sans question
// l'arrête forcément. Les étapes examen n'ont pas de questions.
// Toutes les écritures prennent l'id de l'étape (et son parcours_id) telle
// qu'affichée, ou l'id de la ligne de positionnement affichée.
export default function ParcoursPositionnement({
  etapes,
  feuilleParId,
  positionnementsParEtape,
  onChange,
}: {
  etapes: Etape[]
  feuilleParId: Map<string, FeuilleChoix>
  positionnementsParEtape: Map<string, Positionnement[]>
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  const [pickerEtapeId, setPickerEtapeId] = useState<string | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const feuilles = etapes.filter((e) => e.type === 'feuille')
  const totalQuestions = feuilles.reduce((s, e) => s + (positionnementsParEtape.get(e.id)?.length ?? 0), 0)
  const sansQuestion = feuilles.filter((e) => !positionnementsParEtape.get(e.id)?.length).length

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

  async function ajouter(etape: Etape, q: QcmQuestion) {
    const questions = positionnementsParEtape.get(etape.id) ?? []
    if (questions.some((p) => p.qcm_question_id === q.id)) return
    const ordre = questions.reduce((m, p) => Math.max(m, p.ordre), 0) + 1
    await executer(async () =>
      supabase.from('parcours_positionnement').insert({
        parcours_id: etape.parcours_id,
        etape_id: etape.id,
        qcm_question_id: q.id,
        ordre,
      })
    )
  }

  // Échange les ordres de deux questions voisines d'une même étape.
  async function deplacer(questions: Positionnement[], index: number, sens: -1 | 1) {
    const a = questions[index]
    const b = questions[index + sens]
    if (!a || !b) return
    const ordreA = a.ordre === b.ordre ? a.ordre + sens : b.ordre
    await executer(async () => {
      const r1 = await supabase.from('parcours_positionnement').update({ ordre: ordreA }).eq('id', a.id)
      if (r1.error) return r1
      return supabase.from('parcours_positionnement').update({ ordre: a.ordre }).eq('id', b.id)
    })
  }

  async function retirer(id: string) {
    const ok = await executer(async () => supabase.from('parcours_positionnement').delete().eq('id', id))
    if (ok) setARetirer(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-text-primary">Test de positionnement</h3>
        <p className="text-xs text-text-muted">
          {totalQuestions} question{totalQuestions > 1 ? 's' : ''}
          {' · '}
          <span className={sansQuestion > 0 ? 'font-semibold text-warning' : ''}>
            {sansQuestion} feuille{sansQuestion > 1 ? 's' : ''} sans question
          </span>
          {totalQuestions > 0 && ` · ${dureeEstimee(totalQuestions)}`}
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
            const questions = positionnementsParEtape.get(etape.id) ?? []
            const vide = questions.length === 0
            const numero = etapes.indexOf(etape) + 1

            return (
              <li
                key={etape.id}
                className="space-y-2 rounded-xl border p-3"
                style={vide ? { background: ORANGE_FOND, borderColor: ORANGE_BORD } : { background: '#FFFFFF' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      <span className="text-text-muted">{numero}. </span>
                      {titre}
                    </p>
                    <p className={`text-xs ${vide ? 'font-semibold text-warning' : 'text-text-muted'}`}>
                      {vide
                        ? 'Aucune question · le test s’arrêtera ici'
                        : `${questions.length} question${questions.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setARetirer(null); setPickerEtapeId(pickerEtapeId === etape.id ? null : etape.id) }}
                    disabled={enCours}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-40"
                  >
                    + Question
                  </button>
                </div>

                {questions.length > 0 && (
                  <ul className="space-y-1">
                    {questions.map((p, i) => (
                      <li key={p.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm text-text-primary">
                              {p.question ? <QcmTexte text={p.question.enonce} compact /> : 'Question introuvable'}
                            </div>
                            {p.question && (
                              <p className="text-xs text-text-muted">
                                {p.question.source ?? 'Sans source'} · niveau {p.question.niveau}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
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
                              onClick={() => setARetirer(p.id)}
                              disabled={enCours}
                              className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50"
                            >
                              Retirer
                            </button>
                          </div>
                        </div>

                        {aRetirer === p.id && (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                            <p className="text-sm text-text-primary">Retirer cette question de la feuille ?</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setARetirer(null)} className={btnSecondaire} disabled={enCours}>
                                Annuler
                              </button>
                              <button type="button" onClick={() => retirer(p.id)} className={btnDanger} disabled={enCours}>
                                Retirer
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {pickerEtapeId === etape.id && (
                  <QcmPicker
                    key={etape.id}
                    titreFeuille={titre}
                    dejaIds={new Set(questions.map((p) => p.qcm_question_id))}
                    enCours={enCours}
                    onAjouter={(q) => ajouter(etape, q)}
                    onFermer={() => setPickerEtapeId(null)}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
