import type { Metadata } from 'next'

// Métadonnées communes aux pages vitrine (URL absolues via metadataBase du layout racine).
// Page sans contenu : noindex (et absente de app/sitemap.ts).
export function vitrineMetadata({
  path,
  title,
  description,
  indexable = false,
}: {
  path: string
  title: string
  description: string
  indexable?: boolean
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, locale: 'fr_FR', type: 'website', siteName: 'Monstro' },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  }
}
