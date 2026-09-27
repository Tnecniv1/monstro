import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDateLongue, getArticle, getArticles, SECTION_LABELS, type Section } from '@/lib/articles'
import { SITE_URL } from '@/lib/site'

export function articleStaticParams(section: Section) {
  return getArticles(section).map((a) => ({ slug: a.slug }))
}

export function articleMetadata(section: Section, slug: string): Metadata {
  const article = getArticle(section, slug)
  if (!article) return {}
  const path = `/${section}/${article.slug}`
  return {
    title: `${article.titre} — Monstro`,
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      title: article.titre,
      description: article.description,
      url: path,
      locale: 'fr_FR',
      siteName: 'Monstro',
      publishedTime: article.date,
      ...(article.image && { images: [{ url: article.image }] }),
    },
  }
}

export default function ArticleView({ section, slug }: { section: Section; slug: string }) {
  const article = getArticle(section, slug)
  if (!article) notFound()

  const url = `${SITE_URL}/${section}/${article.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.titre,
    description: article.description,
    datePublished: article.date,
    inLanguage: 'fr-FR',
    mainEntityOfPage: url,
    url,
    ...(article.image && { image: [`${SITE_URL}${article.image}`] }),
    author: { '@type': 'Organization', name: 'Monstro', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Monstro',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/logo.png` },
    },
  }

  return (
    <article className="max-w-3xl mx-auto space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <Link href={`/${section}`} className="text-sm text-text-muted hover:text-text-secondary transition-colors">
        ← {SECTION_LABELS[section]}
      </Link>

      <header className="space-y-3">
        <h1 className="font-serif font-bold text-4xl sm:text-5xl leading-tight text-text-primary">{article.titre}</h1>
        <p className="text-sm text-gray-400">
          <time dateTime={article.date}>{formatDateLongue(article.date)}</time>
        </p>
      </header>

      {article.image && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-gray-200">
          <Image src={article.image} alt="" fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
        </div>
      )}

      {/* HTML généré au build depuis nos propres fichiers Markdown (le HTML brut du Markdown est ignoré) */}
      <div
        className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-text-primary prose-a:text-accent prose-img:rounded-xl [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden"
        dangerouslySetInnerHTML={{ __html: article.html }}
      />
    </article>
  )
}
