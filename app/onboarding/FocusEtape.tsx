'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ageAujourdhui, etapeFocusValidee, type CategoriesFocus } from './focus'
import { FOCUS } from './texts'

type Categorie = 'chaotique' | 'mecanique'
type Niveau = 'fragile' | 'moyen' | 'fort'

const CATEGORIES: Categorie[] = ['chaotique', 'mecanique']
const NIVEAUX: Niveau[] = ['fragile', 'moyen', 'fort']

// Ligne de recommandation_focus, avec le titre de la feuille (null = case vide).
type Recommandation = {
  categorie: Categorie
  age_min: number
  age_max: number
  niveau: Niveau
  feuille: { titre: string } | null
}

// Les deux catégories à couvrir, cochées dès qu'une feuille est en Focus.
export function ChecklistFocus({ categories }: { categories: CategoriesFocus }) {
  return (
    <ul className="space-y-1.5">
      {CATEGORIES.map((c) => (
        <li key={c} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px] font-bold leading-none ${
              categories[c] ? 'border-accent bg-accent text-white' : 'border-border-strong'
            }`}
          >
            {categories[c] ? '✓' : ''}
          </span>
          <span className={categories[c] ? 'text-text-primary' : 'text-text-secondary'}>{FOCUS.checklist[c]}</span>
          <span className="sr-only">{categories[c] ? '(fait)' : '(à faire)'}</span>
        </li>
      ))}
    </ul>
  )
}

function libelleAge(min: number, max: number): string {
  if (max >= 99) return `${min} et +`
  return min === max ? `${min} ans` : `${min}–${max} ans`
}

// Tableau des feuilles recommandées : une section par catégorie, une ligne par
// tranche d'âge, une colonne par niveau. La ligne de l'âge de l'élève est mise
// en évidence si sa date de naissance est connue.
export function TableauRecommandations({ dateNaissance }: { dateNaissance: string | null }) {
  const [lignes, setLignes] = useState<Recommandation[] | null>(null)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    let actif = true
    createClient()
      .from('recommandation_focus')
      .select('categorie, age_min, age_max, niveau, feuille:feuille_entrainement ( titre )')
      .order('age_min')
      .then(({ data, error }) => {
        if (!actif) return
        if (error) {
          console.error('[onboarding] échec de la lecture des recommandations', error)
          setErreur(true)
          return
        }
        setLignes((data ?? []) as unknown as Recommandation[])
      })
    return () => {
      actif = false
    }
  }, [])

  if (erreur) return <p className="text-sm text-danger">{FOCUS.recommandations.erreur}</p>
  if (!lignes) return <p className="text-sm text-text-muted">{FOCUS.recommandations.chargement}</p>

  const age = ageAujourdhui(dateNaissance)

  return (
    <div className="space-y-4">
      {CATEGORIES.map((categorie) => {
        const deLaCategorie = lignes.filter((l) => l.categorie === categorie)
        const tranches = Array.from(new Map(deLaCategorie.map((l) => [l.age_min, l])).values())
        return (
          <section key={categorie} className="space-y-1.5">
            <h4 className="text-sm font-bold text-text-primary">{FOCUS.recommandations.sections[categorie]}</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[440px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-2 text-text-secondary">
                    <th className="px-2 py-1.5 font-semibold">{FOCUS.recommandations.colonneAge}</th>
                    {NIVEAUX.map((n) => (
                      <th key={n} className="px-2 py-1.5 font-semibold">
                        {FOCUS.recommandations.niveaux[n].nom}
                        <span className="block font-normal text-text-muted">{FOCUS.recommandations.niveaux[n].detail}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tranches.map((tranche) => {
                    const maLigne = age != null && age >= tranche.age_min && age <= tranche.age_max
                    return (
                      <tr key={tranche.age_min} className={`border-t border-border ${maLigne ? 'bg-accent/10' : ''}`}>
                        <th scope="row" className="whitespace-nowrap px-2 py-1.5 align-top font-semibold text-text-primary">
                          {libelleAge(tranche.age_min, tranche.age_max)}
                          {maLigne && (
                            <span className="block font-normal text-accent">{FOCUS.recommandations.votreAge}</span>
                          )}
                        </th>
                        {NIVEAUX.map((n) => {
                          const titre = deLaCategorie.find((l) => l.age_min === tranche.age_min && l.niveau === n)?.feuille
                            ?.titre
                          return (
                            <td key={n} className={`px-2 py-1.5 align-top ${titre ? 'text-text-primary' : 'text-text-muted'}`}>
                              {titre ?? FOCUS.recommandations.caseVide}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

// Modal bloquant de l'étape Focus : ni croix, ni clic extérieur, ni Échap
// (même overlay que les autres modals de l'onboarding, au-dessus des modals
// des pages). Seule issue : aller à la Bibliothèque.
export function FocusModal({ categories, dateNaissance }: { categories: CategoriesFocus; dateNaissance: string | null }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-titre"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h2 id="focus-titre" className="font-semibold text-text-primary">{FOCUS.titre}</h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-text-primary">
          <p>{FOCUS.consigne}</p>
          <p>{FOCUS.geste}</p>
          <ChecklistFocus categories={categories} />
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="font-bold">{FOCUS.recommandations.titre}</h3>
            <p className="text-text-secondary">{FOCUS.recommandations.intro}</p>
            <TableauRecommandations dateNaissance={dateNaissance} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-6 py-4">
          <Link
            href="/bibliotheque"
            className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {FOCUS.bouton}
          </Link>
        </div>
      </div>
    </div>
  )
}

// Bandeau de la Bibliothèque pendant l'étape : consigne courte, checklist à
// jour à chaque mise en Focus ou retrait, et le tableau de recommandations à
// la demande. Les deux catégories cochées : message de réussite et retour à
// l'accueil, où l'invitation au Script 1 prend le relais.
export function BandeauFocus({ categories, dateNaissance }: { categories: CategoriesFocus; dateNaissance: string | null }) {
  const [tableauOuvert, setTableauOuvert] = useState(false)
  const valide = etapeFocusValidee(categories)

  useEffect(() => {
    if (!tableauOuvert) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setTableauOuvert(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tableauOuvert])

  return (
    <>
      <div className="sticky top-0 z-40 -mx-4 space-y-3 border-b border-accent/30 bg-surface px-4 py-3 shadow-sm sm:mx-0 sm:rounded-xl sm:border">
        <p className="text-sm text-text-primary">{valide ? FOCUS.bandeau.reussite : FOCUS.bandeau.consigne}</p>
        <ChecklistFocus categories={categories} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {valide && (
            <Link
              href="/"
              className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {FOCUS.bandeau.continuer}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setTableauOuvert(true)}
            className="text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            {FOCUS.bandeau.lien}
          </button>
        </div>
      </div>

      {tableauOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setTableauOuvert(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommandations-titre"
            className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
              <h2 id="recommandations-titre" className="font-semibold text-text-primary">{FOCUS.recommandations.titre}</h2>
              <button
                type="button"
                onClick={() => setTableauOuvert(false)}
                aria-label={FOCUS.recommandations.fermer}
                className="text-xl leading-none text-text-muted transition-colors hover:text-text-secondary"
              >
                ×
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-6 py-5 text-sm">
              <p className="text-text-secondary">{FOCUS.recommandations.intro}</p>
              <TableauRecommandations dateNaissance={dateNaissance} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
