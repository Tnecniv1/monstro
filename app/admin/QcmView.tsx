'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { seuilFeuille } from '@/lib/parcours/positionnement'
import FeuillePicker from './FeuillePicker'
import QcmSetQuestions from './QcmSetQuestions'
import {
  btnDanger,
  btnPrimaire,
  btnSecondaire,
  champ,
  cheminFeuille,
  COLONNES_QCM_POSITIONNEMENT,
  COLONNES_QCM_SET,
  QUESTIONS_FIABLES,
  type FeuilleChoix,
  type QcmPositionnement,
  type QcmSet,
} from './parcoursObjectifTypes'

// Étape d'un objectif, réduite à ce qui sert ici : quel set elle utilise.
type EtapeSet = { id: string; parcours_id: string; qcm_set_id: string | null }

type Action =
  | { type: 'creer' }
  | { type: 'renommer'; setId: string }
  | { type: 'dupliquer'; setId: string }
  | { type: 'supprimer'; setId: string }

// Code Postgres d'une violation d'unicité (qcm_set : feuille_id + nom).
const DOUBLON = '23505'

// Onglet admin « QCM » : sets de questions du test de positionnement
// (tables qcm_set et qcm_positionnement). Un set appartient à une feuille ;
// chaque étape feuille d'un objectif choisit un set de sa feuille
// (parcours_etape.qcm_set_id, onglet Objectifs). Une feuille est acquise à
// ceil(2n/3) justes sur les n questions actives du set.
// Écritures par l'id affiché ; un set utilisé par un objectif ne peut pas
// être supprimé (vérifié aussi en base juste avant la suppression).
export default function QcmView({
  feuilles,
  feuilleInitialeId,
}: {
  feuilles: FeuilleChoix[]
  // Feuille à ouvrir (lien « Modifier les questions » de l'onglet Objectifs).
  feuilleInitialeId: string | null
}) {
  const supabase = createClient()
  const [sets, setSets] = useState<QcmSet[] | null>(null)
  const [questions, setQuestions] = useState<QcmPositionnement[]>([])
  const [etapes, setEtapes] = useState<EtapeSet[]>([])
  const [nomsParcours, setNomsParcours] = useState<Map<string, string>>(new Map())
  const [feuilleId, setFeuilleId] = useState<string | null>(feuilleInitialeId)
  const [touteLaBibliotheque, setTouteLaBibliotheque] = useState(false)
  const [ouvertId, setOuvertId] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [nom, setNom] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const [s, q, e, p] = await Promise.all([
      supabase.from('qcm_set').select(COLONNES_QCM_SET).order('created_at'),
      supabase.from('qcm_positionnement').select(COLONNES_QCM_POSITIONNEMENT).order('ordre').order('created_at'),
      supabase.from('parcours_etape').select('id, parcours_id, qcm_set_id').not('qcm_set_id', 'is', null),
      supabase.from('parcours').select('id, nom'),
    ])
    const err = s.error ?? q.error ?? e.error ?? p.error
    if (err) {
      console.error('[admin qcm] chargement', err)
      setErreur(err.message)
    }
    setSets((s.data ?? []) as QcmSet[])
    setQuestions((q.data ?? []) as unknown as QcmPositionnement[])
    setEtapes((e.data ?? []) as EtapeSet[])
    setNomsParcours(new Map(((p.data ?? []) as { id: string; nom: string }[]).map((x) => [x.id, x.nom])))
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const feuilleParId = useMemo(() => new Map(feuilles.map((f) => [f.id, f])), [feuilles])
  // Liste par défaut : les feuilles qui ont déjà au moins un set.
  const feuillesAvecSet = useMemo(() => {
    const ids = new Set((sets ?? []).map((s) => s.feuille_id))
    return feuilles.filter((f) => ids.has(f.id))
  }, [feuilles, sets])

  // Questions par set (actives ou non), triées par ordre.
  const questionsParSet = useMemo(() => {
    const m = new Map<string, QcmPositionnement[]>()
    for (const q of questions) {
      if (!m.has(q.set_id)) m.set(q.set_id, [])
      m.get(q.set_id)!.push(q)
    }
    for (const liste of Array.from(m.values())) liste.sort((x, y) => x.ordre - y.ordre)
    return m
  }, [questions])

  // Objectifs (noms, sans doublon) qui utilisent chaque set.
  const objectifsParSet = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const e of etapes) {
      if (!e.qcm_set_id) continue
      const nomObjectif = nomsParcours.get(e.parcours_id) ?? 'Objectif inconnu'
      const liste = m.get(e.qcm_set_id) ?? []
      if (!liste.includes(nomObjectif)) liste.push(nomObjectif)
      m.set(e.qcm_set_id, liste)
    }
    return m
  }, [etapes, nomsParcours])

  const feuille = feuilleId ? feuilleParId.get(feuilleId) ?? null : null
  const setsFeuille = (sets ?? []).filter((s) => s.feuille_id === feuilleId)

  function choisirFeuille(id: string) {
    setFeuilleId(id)
    setOuvertId(null)
    setAction(null)
    setErreur(null)
  }

  function ouvrirAction(a: Action, nomInitial = '') {
    setAction(a)
    setNom(nomInitial)
    setErreur(null)
  }

  function messageErreur(error: { message: string; code?: string }, nomSet: string): string {
    return error.code === DOUBLON ? `Un set « ${nomSet} » existe déjà sur cette feuille.` : error.message
  }

  async function terminer(error: { message: string; code?: string } | null, nomSet = '') {
    if (error) {
      console.error('[admin qcm] set', error)
      setErreur(messageErreur(error, nomSet))
    } else {
      setAction(null)
    }
    await charger()
    setEnCours(false)
  }

  async function creer() {
    const n = nom.trim()
    if (!feuilleId || !n) return
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase.from('qcm_set').insert({ feuille_id: feuilleId, nom: n }).select('id').single()
    if (data) setOuvertId(data.id)
    await terminer(error, n)
  }

  async function renommer(set: QcmSet) {
    const n = nom.trim()
    if (!n) return
    setEnCours(true)
    setErreur(null)
    const { error } = await supabase.from('qcm_set').update({ nom: n }).eq('id', set.id)
    await terminer(error, n)
  }

  // Copie le set et toutes ses questions (actives ou non, même ordre) sous un
  // nouveau nom. Si la copie des questions échoue, le nouveau set est
  // supprimé (ses questions éventuelles avec lui).
  async function dupliquer(set: QcmSet) {
    const n = nom.trim()
    if (!n) return
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase
      .from('qcm_set')
      .insert({ feuille_id: set.feuille_id, nom: n })
      .select('id')
      .single()
    if (error || !data) {
      await terminer(error ?? { message: 'Copie impossible.' }, n)
      return
    }
    const copies = (questionsParSet.get(set.id) ?? []).map((q) => ({
      set_id: data.id,
      feuille_id: set.feuille_id,
      chapitre: q.chapitre,
      ordre: q.ordre,
      enonce: q.enonce,
      choix: q.choix,
      reponses_correctes: q.reponses_correctes,
      image_url: q.image_url,
      actif: q.actif,
    }))
    if (copies.length > 0) {
      const r = await supabase.from('qcm_positionnement').insert(copies)
      if (r.error) {
        await supabase.from('qcm_set').delete().eq('id', data.id)
        await terminer(r.error, n)
        return
      }
    }
    setOuvertId(data.id)
    await terminer(null)
  }

  // Refusée si une étape utilise le set : vérifié en base au dernier moment
  // (supprimer le set viderait sinon le qcm_set_id de l'étape sans le dire).
  async function supprimer(set: QcmSet) {
    setEnCours(true)
    setErreur(null)
    const { data: utilisees, error: errLecture } = await supabase
      .from('parcours_etape')
      .select('parcours_id')
      .eq('qcm_set_id', set.id)
    if (errLecture) {
      await terminer(errLecture)
      return
    }
    if ((utilisees ?? []).length > 0) {
      const noms = Array.from(new Set((utilisees ?? []).map((u) => nomsParcours.get(u.parcours_id) ?? 'Objectif inconnu')))
      setErreur(
        `Impossible de supprimer « ${set.nom} » : il est utilisé par ${noms.length > 1 ? 'les objectifs' : 'l’objectif'} ${noms.join(', ')}. Choisis un autre set pour ces étapes dans l’onglet Objectifs.`
      )
      setAction(null)
      await charger()
      setEnCours(false)
      return
    }
    const { error } = await supabase.from('qcm_set').delete().eq('id', set.id)
    if (!error && ouvertId === set.id) setOuvertId(null)
    await terminer(error)
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      {/* Colonne gauche : choix de la feuille */}
      <aside className="space-y-3 self-start rounded-2xl border border-border bg-surface p-3">
        <h2 className="px-1 text-sm font-bold text-text-primary">Feuille</h2>
        <label className="flex items-center gap-2 px-1 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={touteLaBibliotheque}
            onChange={(e) => setTouteLaBibliotheque(e.target.checked)}
          />
          Toute la bibliothèque (sinon : feuilles qui ont déjà un set)
        </label>
        {!sets ? (
          <p className="px-1 text-sm text-text-muted">Chargement…</p>
        ) : (
          <FeuillePicker
            feuilles={touteLaBibliotheque ? feuilles : feuillesAvecSet}
            selectionId={feuilleId}
            onChoisir={(f) => choisirFeuille(f.id)}
          />
        )}
      </aside>

      {/* Panneau droit : sets de la feuille */}
      <div className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-5">
        {!feuilleId ? (
          <p className="py-10 text-center text-sm text-text-muted">Choisis une feuille.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-text-primary">{feuille?.titre ?? 'Feuille introuvable'}</h3>
                {feuille && <p className="text-xs text-text-muted">{cheminFeuille(feuille) || 'Sans catégorie'}</p>}
              </div>
              <button
                type="button"
                onClick={() => ouvrirAction({ type: 'creer' })}
                className={btnPrimaire}
                disabled={enCours}
              >
                + Set
              </button>
            </div>

            {erreur && <p className="text-sm text-danger">{erreur}</p>}

            {action?.type === 'creer' && (
              <FormNom
                libelle="Nom du nouveau set"
                nom={nom}
                setNom={setNom}
                enCours={enCours}
                valider="Créer"
                onAnnuler={() => setAction(null)}
                onValider={creer}
              />
            )}

            {sets && setsFeuille.length === 0 && action?.type !== 'creer' && (
              <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
                Aucun set pour cette feuille. Crée-en un avec « + Set ».
              </p>
            )}

            <ul className="space-y-2">
              {setsFeuille.map((set) => {
                const qs = questionsParSet.get(set.id) ?? []
                const actives = qs.filter((q) => q.actif).length
                const inactives = qs.length - actives
                const seuil = seuilFeuille(actives)
                const objectifs = objectifsParSet.get(set.id) ?? []
                const ouvert = ouvertId === set.id
                const actionDuSet = action && action.type !== 'creer' && action.setId === set.id ? action : null

                return (
                  <li key={set.id} className="space-y-2 rounded-xl border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-text-primary">{set.nom}</p>
                        <p className={`text-xs ${actives === 0 ? 'font-semibold text-warning' : 'text-text-muted'}`}>
                          {actives === 0
                            ? 'Aucune question active · le test s’arrêtera à cette feuille'
                            : `${actives} question${actives > 1 ? 's' : ''} active${actives > 1 ? 's' : ''} · acquise à ${seuil} juste${seuil > 1 ? 's' : ''}`}
                          {inactives > 0 && ` · ${inactives} inactive${inactives > 1 ? 's' : ''}`}
                        </p>
                        {actives > 0 && actives < QUESTIONS_FIABLES && (
                          <p className="text-xs font-semibold text-warning">Moins de 6 questions : le test sera moins fiable</p>
                        )}
                        <p className="text-xs text-text-muted">
                          {objectifs.length > 0 ? `Utilisé par : ${objectifs.join(', ')}` : 'Utilisé par aucun objectif'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOuvertId(ouvert ? null : set.id)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft"
                        >
                          {ouvert ? 'Fermer' : 'Questions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => ouvrirAction({ type: 'renommer', setId: set.id }, set.nom)}
                          disabled={enCours}
                          className="rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-40"
                        >
                          Renommer
                        </button>
                        <button
                          type="button"
                          onClick={() => ouvrirAction({ type: 'dupliquer', setId: set.id }, `${set.nom} (copie)`)}
                          disabled={enCours}
                          className="rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-40"
                        >
                          Dupliquer
                        </button>
                        <button
                          type="button"
                          onClick={() => ouvrirAction({ type: 'supprimer', setId: set.id })}
                          disabled={enCours}
                          className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-red-50 disabled:opacity-40"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {actionDuSet?.type === 'renommer' && (
                      <FormNom
                        libelle="Nouveau nom"
                        nom={nom}
                        setNom={setNom}
                        enCours={enCours}
                        valider="Renommer"
                        onAnnuler={() => setAction(null)}
                        onValider={() => renommer(set)}
                      />
                    )}
                    {actionDuSet?.type === 'dupliquer' && (
                      <FormNom
                        libelle={`Nom de la copie (${qs.length} question${qs.length > 1 ? 's' : ''} copiée${qs.length > 1 ? 's' : ''})`}
                        nom={nom}
                        setNom={setNom}
                        enCours={enCours}
                        valider="Dupliquer"
                        onAnnuler={() => setAction(null)}
                        onValider={() => dupliquer(set)}
                      />
                    )}
                    {actionDuSet?.type === 'supprimer' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <p className="text-sm text-text-primary">
                          {objectifs.length > 0
                            ? `« ${set.nom} » est utilisé par ${objectifs.join(', ')} : il ne peut pas être supprimé.`
                            : `Supprimer « ${set.nom} » et ses ${qs.length} question${qs.length > 1 ? 's' : ''} ?`}
                        </p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setAction(null)} className={btnSecondaire} disabled={enCours}>
                            {objectifs.length > 0 ? 'Fermer' : 'Annuler'}
                          </button>
                          {objectifs.length === 0 && (
                            <button type="button" onClick={() => supprimer(set)} className={btnDanger} disabled={enCours}>
                              Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {ouvert && (
                      <div className="border-t border-border pt-2">
                        <QcmSetQuestions key={set.id} set={set} questions={qs} onChange={charger} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function FormNom({
  libelle,
  nom,
  setNom,
  enCours,
  valider,
  onAnnuler,
  onValider,
}: {
  libelle: string
  nom: string
  setNom: (n: string) => void
  enCours: boolean
  valider: string
  onAnnuler: () => void
  onValider: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onValider()
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2 p-3"
    >
      <label className="min-w-[200px] flex-1 space-y-1">
        <span className="text-xs font-semibold text-text-secondary">{libelle}</span>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className={champ} autoFocus />
      </label>
      <button type="button" onClick={onAnnuler} className={btnSecondaire} disabled={enCours}>
        Annuler
      </button>
      <button type="submit" className={btnPrimaire} disabled={enCours || !nom.trim()}>
        {valider}
      </button>
    </form>
  )
}
