'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MathText from '../components/MathText'
import type { Niveau } from './ApprendreClient'
import type { Stats } from './QcmTab'

type Choix = { id: string; texte: string }
type Question = {
  id: string
  niveau: number
  enonce: string
  choix: Choix[]
  image_url: string | null
  source: string | null
}
type Progression = { question_id: string; statut: string }
type Resultat = {
  est_correct: boolean
  niveau_valide: boolean
  total: number
  vues: number
  vrai: number
  faux: number
  corrige: number
}

const FLASH_DUREE_MS = 1200
const VALIDATION_DUREE_MS = 1500

function melanger<T>(items: T[]): T[] {
  const copie = [...items]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

function QuestionImage({ url }: { url: string }) {
  const [statut, setStatut] = useState<'chargement' | 'chargee' | 'erreur'>('chargement')

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 440 }}>
      {statut === 'chargement' && (
        <div className="w-full rounded-lg bg-gray-100 animate-pulse" style={{ height: 180 }} />
      )}
      {statut !== 'erreur' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          onLoad={() => setStatut('chargee')}
          onError={() => setStatut('erreur')}
          className={`w-full h-auto rounded-lg ${statut === 'chargee' ? 'block' : 'hidden'}`}
        />
      )}
      {statut === 'erreur' && (
        <p className="text-xs text-gray-400 text-center py-4">Image indisponible</p>
      )}
    </div>
  )
}

interface Props {
  userId: string
  niveau: Niveau
  statsInitial: Stats
  onValidated: (niveau: number) => void
  onStatsUpdate: (niveau: number, stats: Stats) => void
  onExit: () => void
}

export default function QcmSession({ userId, niveau, statsInitial, onValidated, onStatsUpdate, onExit }: Props) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [pool, setPool] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState<Stats>(statsInitial)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<'vrai' | 'faux' | null>(null)
  const [niveauValideMsg, setNiveauValideMsg] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    let annule = false

    async function charger() {
      setLoading(true)
      const [{ data: questionsData }, { data: progressionData }] = await Promise.all([
        supabase
          .from('qcm_question_public')
          .select('id, niveau, enonce, choix, image_url, source')
          .eq('niveau', niveau.niveau),
        supabase
          .from('qcm_progression_question')
          .select('question_id, statut')
          .eq('user_id', userId)
          .eq('niveau', niveau.niveau),
      ])

      if (annule) return

      const questions = (questionsData ?? []) as Question[]
      const progressionMap = new Map<string, string>(
        ((progressionData ?? []) as Progression[]).map((p) => [p.question_id, p.statut])
      )

      const aCorriger = melanger(questions.filter((q) => progressionMap.get(q.id) === 'a_corriger'))
      const nouvelles = melanger(questions.filter((q) => !progressionMap.has(q.id)))
      const pileComplet = [...aCorriger, ...nouvelles]

      if (pileComplet.length === 0) {
        onExitRef.current()
        return
      }

      setPool(pileComplet)
      setIndex(0)
      setLoading(false)
    }

    charger()
    return () => {
      annule = true
    }
  }, [niveau.niveau, userId])

  const questionActuelle = pool[index] ?? null

  useEffect(() => {
    setSelectedIds(new Set())
  }, [questionActuelle?.id])

  function toggleChoice(id: string) {
    if (busy) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function valider() {
    if (!questionActuelle || busy) return
    setBusy(true)

    const { data, error } = await supabase.rpc('qcm_valider_reponse', {
      p_question_id: questionActuelle.id,
      p_choix: Array.from(selectedIds),
    })

    if (error) {
      console.error('[QcmSession] erreur validation:', error)
      setBusy(false)
      return
    }

    const res = (Array.isArray(data) ? data[0] : data) as Resultat
    const nouveauxStats: Stats = {
      total: res.total,
      vues: res.vues,
      vrai: res.vrai,
      faux: res.faux,
      corrige: res.corrige,
    }
    setStats(nouveauxStats)
    onStatsUpdate(niveau.niveau, nouveauxStats)
    setFlash(res.est_correct ? 'vrai' : 'faux')

    if (res.niveau_valide) {
      onValidated(niveau.niveau)
    }

    const t = setTimeout(() => {
      if (res.niveau_valide) {
        setNiveauValideMsg(true)
        const t2 = setTimeout(() => onExitRef.current(), VALIDATION_DUREE_MS)
        timeoutsRef.current.push(t2)
        return
      }

      if (index + 1 < pool.length) {
        setIndex((i) => i + 1)
        setFlash(null)
        setBusy(false)
      } else {
        onExitRef.current()
      }
    }, FLASH_DUREE_MS)
    timeoutsRef.current.push(t)
  }

  return (
    <div className="space-y-5">
      <button onClick={onExit} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Niveaux
      </button>

      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium">
        <span>Niveau {niveau.niveau} - {niveau.nom}</span>
        <span>Vue: {stats.vues}/{stats.total} · Vrai: {stats.vrai} · Faux: {stats.faux} · Corrigé: {stats.corrige}</span>
      </div>

      {niveauValideMsg && (
        <div className="rounded-xl bg-[#4ade80]/20 border border-[#4ade80] px-4 py-3 text-sm font-medium text-gray-900">
          🎉 Niveau validé !
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 py-8 text-center">Chargement…</p>}

      {!loading && !questionActuelle && !niveauValideMsg && (
        <p className="text-center text-sm text-gray-400 py-12">
          Aucune question disponible pour ce niveau pour le moment.
        </p>
      )}

      {!loading && questionActuelle && !niveauValideMsg && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <p className="font-medium text-gray-900 leading-relaxed">
            <MathText text={questionActuelle.enonce} />
          </p>

          {questionActuelle.source && (
            <p className="text-xs text-gray-400">Source : {questionActuelle.source}</p>
          )}

          {questionActuelle.image_url && (
            <QuestionImage key={questionActuelle.id} url={questionActuelle.image_url} />
          )}

          <div className="space-y-2">
            {questionActuelle.choix.map((c) => {
              const coche = selectedIds.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChoice(c.id)}
                  disabled={busy}
                  className={`w-full flex items-center gap-3 text-left rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    coche ? 'border-gray-900 bg-gray-100' : 'border-gray-200'
                  } ${busy ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-gray-400'}`}
                >
                  <span
                    className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border text-[10px] leading-none ${
                      coche ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className="flex-1">
                    <MathText text={c.texte} />
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={valider}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Valider
            </button>
          </div>

          {flash && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-semibold text-center ${
                flash === 'vrai' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {flash === 'vrai' ? '✅ Vrai' : '❌ Faux'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
