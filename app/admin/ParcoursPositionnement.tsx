'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { seuilFeuille } from '@/lib/parcours/positionnement'
import { champ, QUESTIONS_FIABLES, type Etape, type FeuilleChoix, type QcmSet } from './parcoursObjectifTypes'

const ORANGE_FOND = '#FFFBEB'
const ORANGE_BORD = '#FDE68A'
const SECONDES_PAR_QUESTION = 30

function dureeEstimee(nbQuestions: number): string {
  const s = nbQuestions * SECONDES_PAR_QUESTION
  return s < 60 ? `environ ${s} s` : `environ ${Math.ceil(s / 60)} min`
}

// Test de positionnement d'un objectif : une ligne par étape feuille, avec le
// set de questions choisi (parcours_etape.qcm_set_id, parmi les sets de la
// feuille, ou « Aucun »). Les questions se modifient dans l'onglet QCM.
// Seules les questions actives comptent (lib/parcours/positionnement.ts) :
// une feuille est acquise à ceil(2n/3) justes ; le test s'arrête à la
// première feuille non acquise ; une étape sans set ou sans question active
// l'arrête forcément. Durée estimée : pire cas, toutes les questions posées.
// Écriture : le qcm_set_id de l'étape affichée, par son id.
export default function ParcoursPositionnement({
  etapes,
  feuilleParId,
  sets,
  activesParSet,
  onChange,
  onModifierQuestions,
}: {
  etapes: Etape[]
  feuilleParId: Map<string, FeuilleChoix>
  // Sets du test (toutes feuilles).
  sets: QcmSet[]
  // Nombre de questions actives par set.
  activesParSet: Map<string, number>
  onChange: () => Promise<void>
  // Ouvre l'onglet QCM sur la feuille.
  onModifierQuestions: (feuilleId: string) => void
}) {
  const supabase = createClient()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const feuilles = etapes.filter((e) => e.type === 'feuille')
  const nbActives = (e: Etape) => (e.qcm_set_id ? activesParSet.get(e.qcm_set_id) ?? 0 : 0)
  const totalActives = feuilles.reduce((s, e) => s + nbActives(e), 0)
  const sansQuestion = feuilles.filter((e) => nbActives(e) === 0).length

  async function choisirSet(etape: Etape, setId: string | null) {
    setEnCours(etape.id)
    setErreur(null)
    const { error } = await supabase.from('parcours_etape').update({ qcm_set_id: setId }).eq('id', etape.id)
    if (error) {
      console.error('[admin positionnement]', error)
      setErreur(error.message)
    }
    await onChange()
    setEnCours(null)
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
        <ol className="space-y-1.5">
          {feuilles.map((etape) => {
            const feuille = etape.feuille_id ? feuilleParId.get(etape.feuille_id) : undefined
            const titre = feuille?.titre ?? 'Feuille introuvable'
            const setsFeuille = sets.filter((s) => s.feuille_id === etape.feuille_id)
            // Set choisi rattaché à une autre feuille (ne devrait pas arriver) :
            // affiché pour pouvoir le remplacer.
            const setEtranger =
              etape.qcm_set_id && !setsFeuille.some((s) => s.id === etape.qcm_set_id)
                ? sets.find((s) => s.id === etape.qcm_set_id) ?? null
                : null
            const actives = nbActives(etape)
            const seuil = seuilFeuille(actives)
            const vide = actives === 0
            const numero = etapes.indexOf(etape) + 1

            return (
              <li
                key={etape.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2"
                style={vide ? { background: ORANGE_FOND, borderColor: ORANGE_BORD } : { background: '#FFFFFF' }}
              >
                <p className="min-w-[160px] flex-1 truncate text-sm font-semibold text-text-primary">
                  <span className="text-text-muted">{numero}. </span>
                  {titre}
                </p>
                <select
                  value={etape.qcm_set_id ?? ''}
                  onChange={(e) => choisirSet(etape, e.target.value || null)}
                  disabled={enCours !== null}
                  aria-label={`Set de questions de ${titre}`}
                  className={`${champ} w-auto min-w-[140px] py-1`}
                >
                  <option value="">Aucun</option>
                  {setsFeuille.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                  {setEtranger && <option value={setEtranger.id}>{setEtranger.nom} (autre feuille)</option>}
                </select>
                <span className={`text-xs ${vide ? 'font-semibold text-warning' : 'text-text-muted'}`}>
                  {!etape.qcm_set_id
                    ? 'Aucun set · le test s’arrêtera ici'
                    : vide
                      ? 'Aucune question active · le test s’arrêtera ici'
                      : `${actives} question${actives > 1 ? 's' : ''} · acquise à ${seuil} juste${seuil > 1 ? 's' : ''}`}
                  {!vide && actives < QUESTIONS_FIABLES && (
                    <span className="font-semibold text-warning"> · moins de 6 questions</span>
                  )}
                </span>
                {etape.feuille_id && (
                  <button
                    type="button"
                    onClick={() => onModifierQuestions(etape.feuille_id!)}
                    className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                  >
                    Modifier les questions
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
