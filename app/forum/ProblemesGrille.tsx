'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useForumAttente } from '../components/ForumAttenteProvider'
import { estQuestionFaq, faqHref, problemeHref } from './types'
import type { Feuille, FiltreProblemes, ForumTicket, TicketStatut } from './types'

interface Props {
  feuilles: Feuille[]
  // Feuilles en Focus de l'utilisateur connecté (admin compris), dans l'ordre
  // de mise en Focus.
  focusIds: string[]
  userId: string
  // Gardé par ForumClient, reflété dans ?filtre=.
  filtre: FiltreProblemes
  onFiltre: (filtre: FiltreProblemes) => void
}

// Question Problème numérotée : de quoi compter et trier les problèmes.
type QuestionProbleme = {
  id: string
  user_id: string
  feuille_id: string
  numero_exercice: number
  statut: TicketStatut | null
  created_at: string
}

type Carte = {
  feuille: Feuille
  numero: number
  questions: number
  ouvertes: number
  nouveau: boolean
}

type Pastille = { id: string; label: string }

// Question de la FAQ : de quoi remplir la carte FAQ.
type QuestionFaq = Pick<ForumTicket, 'id' | 'sujet' | 'feuille_id' | 'numero_exercice' | 'statut'>

// Onglet Problèmes : une carte par problème (feuille + numéro), avec un seul
// filtre à la fois, le même pour l'admin et les élèves :
// - « Mes questions » (défaut) : problèmes où l'utilisateur a posé une
//   question ; sa question ouverte d'abord, puis sa question la plus récente ;
// - une feuille en Focus : tous ses problèmes, de 1 à volume, par numéro ;
// - « Toutes les questions » : problèmes qui ont au moins une question, de
//   n'importe qui ; question ouverte d'abord, puis question la plus récente.
// La carte FAQ (Méthode, Application, questions Problème sans numéro) est
// toujours la première de la grille, hors compteur.
export default function ProblemesGrille({ feuilles, focusIds, userId, filtre, onFiltre }: Props) {
  // Non-lu de l'utilisateur (ses propres questions, cf. forum_tickets_en_attente).
  const { ids: enAttente } = useForumAttente()
  const [questions, setQuestions] = useState<QuestionProbleme[] | null>(null)
  const [questionsFaq, setQuestionsFaq] = useState<QuestionFaq[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('forum_tickets')
      .select('id, sujet, feuille_id, numero_exercice, statut')
      .is('topic_id', null)
      .then(({ data }) => {
        if (!cancelled) setQuestionsFaq(((data ?? []) as QuestionFaq[]).filter(estQuestionFaq))
      })
    supabase
      .from('forum_tickets')
      .select('id, user_id, feuille_id, numero_exercice, statut, created_at')
      .is('topic_id', null)
      .eq('sujet', 'probleme')
      .not('feuille_id', 'is', null)
      .not('numero_exercice', 'is', null)
      .then(({ data }) => {
        if (!cancelled) setQuestions((data ?? []) as QuestionProbleme[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const feuilleById = useMemo(() => new Map(feuilles.map((f) => [f.id, f])), [feuilles])
  const feuillesFocus = useMemo(
    () => focusIds.map((id) => feuilleById.get(id)).filter((f): f is Feuille => !!f),
    [focusIds, feuilleById]
  )
  // Une feuille précise : son nom serait répété sur chaque carte.
  const afficherFeuille = filtre === 'mes' || filtre === 'toutes'

  const cartes = useMemo(() => {
    if (!questions) return []
    const parProbleme = new Map<string, QuestionProbleme[]>()
    questions.forEach((q) => {
      const cle = `${q.feuille_id}:${q.numero_exercice}`
      parProbleme.set(cle, [...(parProbleme.get(cle) ?? []), q])
    })

    function carte(feuille: Feuille, numero: number): Carte {
      const qs = parProbleme.get(`${feuille.id}:${numero}`) ?? []
      return {
        feuille,
        numero,
        questions: qs.length,
        ouvertes: qs.filter((q) => q.statut !== 'ferme').length,
        nouveau: qs.some((q) => enAttente.has(q.id)),
      }
    }

    // Une feuille : 1 à volume, plus les numéros au-delà du volume qui ont une question.
    if (filtre !== 'mes' && filtre !== 'toutes') {
      const feuille = feuilleById.get(filtre)
      if (!feuille) return []
      const numeros = new Set<number>()
      for (let n = 1; n <= (feuille.volume ?? 0); n++) numeros.add(n)
      questions.forEach((q) => {
        if (q.feuille_id === feuille.id) numeros.add(q.numero_exercice)
      })
      return Array.from(numeros)
        .sort((a, b) => a - b)
        .map((n) => carte(feuille, n))
    }

    // Mes questions / Toutes les questions : un problème par groupe de
    // questions retenues, trié sur ces questions (ouverte d'abord, puis la
    // plus récente).
    const resultat: { carte: Carte; ouverte: boolean; derniere: string }[] = []
    parProbleme.forEach((qs) => {
      const retenues = filtre === 'mes' ? qs.filter((q) => q.user_id === userId) : qs
      const feuille = feuilleById.get(qs[0].feuille_id)
      if (retenues.length === 0 || !feuille) return
      resultat.push({
        carte: carte(feuille, qs[0].numero_exercice),
        ouverte: retenues.some((q) => q.statut !== 'ferme'),
        derniere: retenues.reduce((max, q) => (q.created_at > max ? q.created_at : max), ''),
      })
    })
    return resultat
      .sort((a, b) => Number(b.ouverte) - Number(a.ouverte) || b.derniere.localeCompare(a.derniere))
      .map((r) => r.carte)
  }, [questions, filtre, feuilleById, userId, enAttente])

  const pastilles: Pastille[] = [
    { id: 'mes', label: 'Mes questions' },
    ...feuillesFocus.map((f) => ({ id: f.id, label: f.titre })),
    { id: 'toutes', label: 'Toutes les questions' },
  ]

  const nb = cartes.length
  const messageVide =
    filtre === 'mes'
      ? 'Tu n’as encore posé aucune question. Choisis une de tes feuilles pour voir ses problèmes.'
      : filtre === 'toutes'
        ? 'Aucune question pour l’instant.'
        : 'Aucun problème pour cette feuille.'

  return (
    <section className="space-y-7">
      <div className="space-y-3">
        <div role="group" aria-label="Filtrer" className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.04em] text-text-muted">Filtrer</p>
          <div className="flex flex-wrap gap-2">
            {pastilles.map((p) => {
              const active = filtre === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onFiltre(p.id)}
                  aria-pressed={active}
                  className={`min-h-[44px] rounded-[10px] border px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? 'border-accent bg-accent font-bold text-white'
                      : 'border-border bg-surface font-semibold text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
        {questions && (
          <p className="text-sm text-text-muted">
            {nb} problème{nb > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {!questions ? (
        <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          {nb === 0 && (
            <p className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
              {messageVide}
            </p>
          )}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <li>
              <CarteGrille
                href={faqHref(filtre)}
                label="Méthode · Application"
                titre="FAQ"
                questions={questionsFaq.length}
                ouvertes={questionsFaq.filter((q) => q.statut !== 'ferme').length}
                nouveau={questionsFaq.some((q) => enAttente.has(q.id))}
              />
            </li>
            {cartes.map((c) => (
              <li key={`${c.feuille.id}:${c.numero}`}>
                <CarteGrille
                  href={problemeHref(c.feuille.id, c.numero, filtre)}
                  label={afficherFeuille ? c.feuille.titre : null}
                  titre={<>N°&nbsp;{c.numero}</>}
                  questions={c.questions}
                  ouvertes={c.ouvertes}
                  nouveau={c.nouveau}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// Format commun des cartes de la grille (problèmes et FAQ) : label, titre
// (+ « Nouveau »), pied avec le nombre de questions et leur statut.
function CarteGrille({
  href,
  label,
  titre,
  questions,
  ouvertes,
  nouveau,
}: {
  href: string
  label: string | null
  titre: React.ReactNode
  questions: number
  ouvertes: number
  nouveau: boolean
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-3 rounded-[14px] border border-border bg-surface p-5 transition-colors hover:border-border-strong"
    >
      {label && <p className="truncate text-xs font-bold uppercase tracking-[0.04em] text-text-muted">{label}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-text-primary">{titre}</p>
        {nouveau && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-accent">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            Nouveau
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {questions === 0 ? 'Aucune question' : `${questions} question${questions > 1 ? 's' : ''}`}
        </span>
        {ouvertes > 0 ? (
          <span className="shrink-0 rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">
            {ouvertes} ouverte{ouvertes > 1 ? 's' : ''}
          </span>
        ) : questions > 0 ? (
          <span className="shrink-0 rounded-lg bg-success/15 px-2 py-1 text-xs font-bold text-success">✓ Résolu</span>
        ) : null}
      </div>
    </Link>
  )
}
