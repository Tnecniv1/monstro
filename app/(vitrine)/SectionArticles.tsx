import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { VitrineTitre } from '@/app/components/VitrineShell'
import { formatDateLongue, getArticles, SECTION_LABELS, type Article, type Section } from '@/lib/articles'
import { vitrineMetadata } from './metadata'

// Fonds pastel de la grille d'illustrations de LandingPage (le blanc est écarté :
// il se confondrait avec la carte), pour les articles sans image de couverture.
const FONDS_PASTEL = ['bg-violet-100', 'bg-green-100', 'bg-orange-100', 'bg-gray-100']

function fondPastel(slug: string): string {
  let hash = 0
  for (const c of slug) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return FONDS_PASTEL[hash % FONDS_PASTEL.length]
}

// Page liste : indexable dès qu'au moins un article est publié.
export function sectionMetadata(section: Section, description: string): Metadata {
  return vitrineMetadata({
    path: `/${section}`,
    title: `${SECTION_LABELS[section]} — Monstro`, // TODO : titre définitif
    description,
    indexable: getArticles(section).length > 0,
  })
}

export default function SectionArticles({ section }: { section: Section }) {
  const articles = getArticles(section)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <VitrineTitre>{SECTION_LABELS[section]}</VitrineTitre>

      {articles.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <li key={article.slug}>
              <CarteArticle article={article} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CarteArticle({ article }: { article: Article }) {
  const { section, slug, titre, description, date, image } = article
  return (
    <Link
      href={`/${section}/${slug}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-accent/40"
    >
      <div className={`relative aspect-[16/10] ${image ? 'bg-gray-100' : fondPastel(slug)}`}>
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h2 className="font-serif text-lg font-bold leading-snug text-text-primary">{titre}</h2>
        <p className="line-clamp-2 text-sm text-text-secondary">{description}</p>
        <p className="mt-auto pt-1 text-xs text-gray-400">
          <time dateTime={date}>{formatDateLongue(date)}</time>
        </p>
      </div>
    </Link>
  )
}
