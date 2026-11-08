'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QcmTexte from '../components/QcmTexte'
import { btnPrimaire, btnSecondaire, champ, COLONNES_QCM, type QcmQuestion } from './parcoursObjectifTypes'

const PAGE = 20
const NIVEAUX = [21, 41, 42, 43]
const SANS_SOURCE = '__sans_source__'

// Échappe les jokers de ilike (% _ \) saisis dans la recherche.
function echapper(q: string) {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// Sélecteur de la banque qcm_question pour une feuille du test de
// positionnement : recherche dans l'énoncé, filtres niveau et source,
// chargement par 20, aperçu au clic. Les questions déjà associées à la
// feuille sont grisées.
export default function QcmPicker({
  titreFeuille,
  dejaIds,
  enCours,
  onAjouter,
  onFermer,
}: {
  titreFeuille: string
  dejaIds: Set<string>
  enCours: boolean
  onAjouter: (q: QcmQuestion) => void
  onFermer: () => void
}) {
  const supabase = createClient()
  const [saisie, setSaisie] = useState('')
  const [recherche, setRecherche] = useState('')
  const [niveau, setNiveau] = useState('')
  const [source, setSource] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [resultats, setResultats] = useState<QcmQuestion[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [apercuId, setApercuId] = useState<string | null>(null)
  // Numéro de la dernière requête : une réponse plus ancienne est ignorée.
  const requete = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setRecherche(saisie.trim()), 300)
    return () => clearTimeout(t)
  }, [saisie])

  useEffect(() => {
    supabase
      .from('qcm_question')
      .select('source')
      .not('source', 'is', null)
      .range(0, 4999)
      .then(({ data, error }) => {
        if (error) console.error('[admin positionnement] sources', error)
        const liste = Array.from(new Set((data ?? []).map((r: { source: string }) => r.source)))
        setSources(liste.sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })))
      })
  }, [])

  async function charger(depuis: number) {
    const n = ++requete.current
    setChargement(true)
    setErreur(null)
    let req = supabase.from('qcm_question').select(COLONNES_QCM, { count: 'exact' })
    if (recherche) req = req.ilike('enonce', `%${echapper(recherche)}%`)
    if (niveau) req = req.eq('niveau', Number(niveau))
    if (source === SANS_SOURCE) req = req.is('source', null)
    else if (source) req = req.eq('source', source)
    const { data, error, count } = await req
      .order('niveau')
      .order('source', { nullsFirst: false })
      .order('id')
      .range(depuis, depuis + PAGE - 1)
    if (n !== requete.current) return
    if (error) {
      console.error('[admin positionnement] banque', error)
      setErreur(error.message)
    }
    const page = (data ?? []) as QcmQuestion[]
    setResultats((r) => (depuis === 0 ? page : [...r, ...page]))
    setTotal(count ?? null)
    setChargement(false)
  }

  useEffect(() => {
    setApercuId(null)
    charger(0)
  }, [recherche, niveau, source])

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">Ajouter une question · {titreFeuille}</p>
        <button type="button" onClick={onFermer} className={btnSecondaire}>
          Fermer
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_180px]">
        <input
          type="text"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Rechercher dans l’énoncé…"
          className={champ}
          autoFocus
        />
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className={champ}>
          <option value="">Tous niveaux</option>
          {NIVEAUX.map((n) => (
            <option key={n} value={n}>
              Niveau {n}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={champ}>
          <option value="">Toutes sources</option>
          <option value={SANS_SOURCE}>Sans source</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}
      {total != null && (
        <p className="text-xs text-text-muted">
          {total} question{total > 1 ? 's' : ''}
        </p>
      )}

      <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface">
        {!chargement && resultats.length === 0 && (
          <li className="px-3 py-2 text-sm text-text-muted">Aucune question.</li>
        )}
        {resultats.map((q) => {
          const deja = dejaIds.has(q.id)
          const ouvert = apercuId === q.id
          return (
            <li key={q.id} className={deja ? 'opacity-50' : ''}>
              <button
                type="button"
                onClick={() => setApercuId(ouvert ? null : q.id)}
                className={`w-full px-3 py-2 text-left transition-colors ${ouvert ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
              >
                <span className="line-clamp-2 block text-sm text-text-primary">
                  <QcmTexte text={q.enonce} compact />
                </span>
                <span className="block text-xs text-text-muted">
                  {q.source ?? 'Sans source'} · niveau {q.niveau}
                  {q.image_url ? ' · image' : ''}
                  {deja ? ' · déjà dans cette feuille' : ''}
                </span>
              </button>
              {ouvert && <Apercu question={q} deja={deja} enCours={enCours} onAjouter={() => onAjouter(q)} />}
            </li>
          )
        })}
        {chargement && <li className="px-3 py-2 text-sm text-text-muted">Chargement…</li>}
      </ul>

      {total != null && resultats.length < total && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => charger(resultats.length)}
            className={btnSecondaire}
            disabled={chargement}
          >
            Charger {Math.min(PAGE, total - resultats.length)} de plus
          </button>
        </div>
      )}
    </div>
  )
}

function Apercu({
  question,
  deja,
  enCours,
  onAjouter,
}: {
  question: QcmQuestion
  deja: boolean
  enCours: boolean
  onAjouter: () => void
}) {
  const bonnes = new Set(question.reponses_correctes ?? [])
  return (
    <div className="space-y-3 border-t border-border bg-surface px-3 py-3">
      <div className="text-sm text-text-primary">
        <QcmTexte text={question.enonce} />
      </div>
      {question.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image_url} alt="" className="max-h-60 rounded-lg border border-border" />
      )}
      <ul className="space-y-1">
        {(question.choix ?? []).map((c) => {
          const bonne = bonnes.has(c.id)
          return (
            <li
              key={c.id}
              className={`flex gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                bonne ? 'border-green-200 bg-green-50 font-semibold text-success' : 'border-border text-text-primary'
              }`}
            >
              <span className="shrink-0 uppercase">{c.id}.</span>
              <span className="min-w-0">
                <QcmTexte text={c.texte} />
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onAjouter} className={btnPrimaire} disabled={deja || enCours}>
          {deja ? 'Déjà dans cette feuille' : 'Ajouter à cette feuille'}
        </button>
      </div>
    </div>
  )
}
