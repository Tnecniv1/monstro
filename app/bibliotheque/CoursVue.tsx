'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getSignedPdfUrl } from '@/lib/getSignedPdfUrl'
import { CATEGORIES_COURS, CATEGORIE_COURS_LABEL, type CategorieCours, type Cours } from './cours'

interface Props {
  cours: Cours[]
  categorie: CategorieCours | null
  onCategorie: (categorie: CategorieCours | null) => void
  // Toggle « Problèmes | Cours », à droite des pastilles de catégorie.
  toggleVue: ReactNode
}

// Vue « Cours » : recherche par titre, pastilles de catégorie (bascules,
// aucune = tous) et cartes au style des feuilles, qui ouvrent le PDF dans
// /viewer comme elles.
export default function CoursVue({ cours, categorie, onCategorie, toggleVue }: Props) {
  const router = useRouter()
  const [recherche, setRecherche] = useState('')

  const coursFiltres = useMemo(() => {
    const q = recherche.toLowerCase()
    return cours.filter(
      (c) => (!categorie || c.categorie === categorie) && (!q || c.titre.toLowerCase().includes(q))
    )
  }, [cours, categorie, recherche])

  return (
    <div className="space-y-4">
      {/* Recherche */}
      <input
        type="text"
        placeholder="Rechercher par titre…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />

      {/* Catégories, toggle de vue à droite (même place que dans la vue Problèmes) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES_COURS.map((c) => (
            <button
              key={c}
              onClick={() => onCategorie(categorie === c ? null : c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categorie === c
                  ? 'bg-surface-2 ring-1 ring-border-strong text-text-primary'
                  : 'bg-surface ring-1 ring-border text-text-secondary hover:bg-surface-2'
              }`}
            >
              {CATEGORIE_COURS_LABEL[c]}
            </button>
          ))}
        </div>
        {toggleVue}
      </div>

      {/* Résultats */}
      {cours.length === 0 ? (
        <p className="text-center text-sm text-text-muted py-12">Aucun cours pour l&apos;instant.</p>
      ) : coursFiltres.length === 0 ? (
        <p className="text-center text-sm text-text-muted py-12">Aucun cours trouvé.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {coursFiltres.map((c) => (
            <div
              key={c.id}
              onClick={async () => {
                if (!c.pdf_url) return
                const signed = await getSignedPdfUrl(c.pdf_url)
                if (signed) router.push(`/viewer?url=${encodeURIComponent(signed)}`)
              }}
              className={`rounded-xl border border-border bg-surface p-5 space-y-3 ${
                c.pdf_url ? 'cursor-pointer hover:border-border-strong transition-colors' : 'cursor-default opacity-60'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-semibold text-text-primary leading-snug">{c.titre}</p>
                {c.description && <p className="text-xs text-text-secondary line-clamp-2">{c.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-text-secondary">
                  {CATEGORIE_COURS_LABEL[c.categorie]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
