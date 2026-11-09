'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ParcoursEtapeForm, { type ValeursEtape } from './ParcoursEtapeForm'
import {
  btnDanger,
  btnPrimaire,
  btnSecondaire,
  plageEtape,
  setParDefaut,
  type Etape,
  type FeuilleChoix,
  type QcmSet,
} from './parcoursObjectifTypes'

type Formulaire = { type: 'feuille' | 'examen'; etape: Etape | null }

const VERT_TEXTE = '#15803D'
const VERT_FOND = '#F0FDF4'

// Liste ordonnée des étapes d'un parcours : ajout (feuille ou examen),
// modification, suppression confirmée dans la page, réordonnancement ↑ ↓.
export default function ParcoursEtapes({
  parcoursId,
  etapes,
  feuilles,
  feuillesExamen,
  feuilleParId,
  feuillesChaotiquesIds,
  sets,
  onChange,
}: {
  parcoursId: string
  etapes: Etape[]
  feuilles: FeuilleChoix[]
  feuillesExamen: FeuilleChoix[]
  feuilleParId: Map<string, FeuilleChoix>
  // Feuilles chaotiques de ce parcours : elles ne peuvent pas devenir une étape.
  feuillesChaotiquesIds: Set<string>
  // Sets du test de positionnement (toutes feuilles).
  sets: QcmSet[]
  onChange: () => Promise<void>
}) {
  const supabase = createClient()
  const [formulaire, setFormulaire] = useState<Formulaire | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function executer(action: () => Promise<{ error: { message: string } | null }>) {
    setEnCours(true)
    setErreur(null)
    const { error } = await action()
    if (error) {
      console.error('[admin objectifs] étapes', error)
      setErreur(error.message)
    }
    await onChange()
    setEnCours(false)
    return !error
  }

  // obligatoire et entree_niveau ne sont pas envoyés : valeurs par défaut de la base.
  async function enregistrer(v: ValeursEtape) {
    const etape = formulaire?.etape
    if (v.feuille_id && feuillesChaotiquesIds.has(v.feuille_id)) {
      setErreur(
        `« ${feuilleParId.get(v.feuille_id)?.titre ?? 'Cette feuille'} » est déjà une feuille chaotique de ce parcours : retire-la des feuilles chaotiques avant d’en faire une étape.`
      )
      return
    }
    // Set du test : à l'ajout, ou si la feuille change, l'unique set de la
    // feuille (sinon aucun) ; feuille inchangée : set inchangé.
    const qcmSetId = v.type === 'feuille' ? setParDefaut(v.feuille_id, sets) : null
    const ok = await executer(async () => {
      if (etape) {
        const champs = v.feuille_id === etape.feuille_id ? v : { ...v, qcm_set_id: qcmSetId }
        return supabase.from('parcours_etape').update(champs).eq('id', etape.id)
      }
      const ordre = etapes.reduce((m, e) => Math.max(m, e.ordre), 0) + 1
      return supabase.from('parcours_etape').insert({ ...v, qcm_set_id: qcmSetId, parcours_id: parcoursId, ordre })
    })
    if (ok) setFormulaire(null)
  }

  // Échange les ordres de deux étapes voisines en passant par une valeur
  // libre, pour ne pas heurter une éventuelle contrainte d'unicité.
  async function deplacer(index: number, sens: -1 | 1) {
    const a = etapes[index]
    const b = etapes[index + sens]
    if (!a || !b) return
    const libre = etapes.reduce((m, e) => Math.max(m, e.ordre), 0) + 1
    await executer(async () => {
      const r1 = await supabase.from('parcours_etape').update({ ordre: libre }).eq('id', a.id)
      if (r1.error) return r1
      const r2 = await supabase.from('parcours_etape').update({ ordre: a.ordre }).eq('id', b.id)
      if (r2.error) return r2
      return supabase.from('parcours_etape').update({ ordre: b.ordre }).eq('id', a.id)
    })
  }

  async function supprimer(id: string) {
    const ok = await executer(async () => supabase.from('parcours_etape').delete().eq('id', id))
    if (ok) setASupprimer(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text-primary">Étapes</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormulaire({ type: 'feuille', etape: null })}
            className={btnPrimaire}
            disabled={enCours}
          >
            + Feuille
          </button>
          <button
            type="button"
            onClick={() => setFormulaire({ type: 'examen', etape: null })}
            className={btnPrimaire}
            disabled={enCours}
          >
            + Examen
          </button>
        </div>
      </div>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {formulaire && !formulaire.etape && (
        <ParcoursEtapeForm
          key={`nouveau-${formulaire.type}`}
          type={formulaire.type}
          initial={null}
          feuilles={feuilles}
          feuillesExamen={feuillesExamen}
          feuilleParId={feuilleParId}
          enCours={enCours}
          onAnnuler={() => setFormulaire(null)}
          onEnregistrer={enregistrer}
        />
      )}

      {etapes.length === 0 && !formulaire && (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          Aucune étape. Ajoute une feuille ou un examen.
        </p>
      )}

      <ol className="space-y-2">
        {etapes.map((e, i) => {
          if (formulaire?.etape?.id === e.id) {
            return (
              <li key={e.id}>
                <ParcoursEtapeForm
                  key={e.id}
                  type={e.type}
                  initial={e}
                  feuilles={feuilles}
                  feuillesExamen={feuillesExamen}
                  feuilleParId={feuilleParId}
                  enCours={enCours}
                  onAnnuler={() => setFormulaire(null)}
                  onEnregistrer={enregistrer}
                />
              </li>
            )
          }

          const examen = e.type === 'examen'
          const feuille = e.feuille_id ? feuilleParId.get(e.feuille_id) : undefined

          return (
            <li
              key={e.id}
              className="rounded-xl border p-3"
              style={examen ? { background: VERT_FOND, borderColor: '#BBF7D0' } : { background: '#FFFFFF' }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={examen ? { background: VERT_TEXTE, color: '#FFFFFF' } : { background: '#F3F4F6', color: '#4B5563' }}
                >
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  {examen ? (
                    <>
                      <p className="text-sm font-semibold" style={{ color: VERT_TEXTE }}>
                        {e.libelle}
                      </p>
                      <p className="text-xs" style={{ color: VERT_TEXTE }}>
                        {feuille?.titre ?? 'Feuille introuvable'}
                        {feuille?.volume ? ` · ${feuille.volume} exercices` : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-text-primary">{feuille?.titre ?? 'Feuille introuvable'}</p>
                      <p className="text-xs text-text-muted">{plageEtape(e, feuille?.volume)}</p>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => deplacer(i, -1)}
                    disabled={enCours || i === 0}
                    aria-label="Monter l’étape"
                    className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => deplacer(i, 1)}
                    disabled={enCours || i === etapes.length - 1}
                    aria-label="Descendre l’étape"
                    className="rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => { setASupprimer(null); setFormulaire({ type: e.type, etape: e }) }}
                    disabled={enCours}
                    className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setASupprimer(e.id)}
                    disabled={enCours}
                    className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              {aSupprimer === e.id && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm text-text-primary">Supprimer cette étape ?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setASupprimer(null)} className={btnSecondaire} disabled={enCours}>
                      Annuler
                    </button>
                    <button type="button" onClick={() => supprimer(e.id)} className={btnDanger} disabled={enCours}>
                      Supprimer
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
