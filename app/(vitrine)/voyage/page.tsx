import Link from 'next/link'
import { VitrineTitre } from '@/app/components/VitrineShell'
import { getVoyage } from '@/lib/voyage'
import { vitrineMetadata } from '../metadata'

// Fichier absent ou en brouillon : titre seul, noindex, hors sitemap.
export function generateMetadata() {
  const voyage = getVoyage()
  return vitrineMetadata({
    path: '/voyage',
    title: voyage?.titre ?? 'Voyage — Monstro',
    description: voyage?.description ?? 'Monstro, la promesse de réussite. Apprendre à raisonner.',
    indexable: voyage !== null,
  })
}

export default function VoyagePage() {
  const voyage = getVoyage()

  if (!voyage) {
    return (
      <div className="max-w-2xl mx-auto">
        <VitrineTitre>Voyage</VitrineTitre>
      </div>
    )
  }

  return (
    <article className="max-w-2xl mx-auto break-words">
      <VitrineTitre>{voyage.titre}</VitrineTitre>

      {/* HTML généré au build depuis notre propre fichier Markdown (le HTML brut du Markdown est ignoré).
          h2 : filet et espace au-dessus, sauf en tête de texte. blockquote : exergue centré, sans bordure ni guillemets. */}
      <div
        className="prose prose-lg mt-12 max-w-none [--tw-prose-body:theme(colors.text.primary)] prose-a:text-accent prose-h2:mb-6 prose-h2:mt-14 prose-h2:border-t prose-h2:border-gray-200 prose-h2:pt-12 prose-h2:font-serif prose-h2:text-2xl prose-h2:font-bold prose-h2:text-text-primary sm:prose-h2:text-3xl [&>h2:first-child]:mt-0 [&>h2:first-child]:border-t-0 [&>h2:first-child]:pt-0 prose-blockquote:my-12 prose-blockquote:border-0 prose-blockquote:px-0 prose-blockquote:text-center prose-blockquote:font-serif prose-blockquote:text-2xl prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:leading-snug prose-blockquote:text-accent sm:prose-blockquote:text-3xl [&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden"
        dangerouslySetInnerHTML={{ __html: voyage.html }}
      />

      {voyage.bouton && (
        <div className="mt-10 flex justify-center">
          <Link
            href="/?mode=inscription"
            className="rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {voyage.bouton}
          </Link>
        </div>
      )}
    </article>
  )
}
