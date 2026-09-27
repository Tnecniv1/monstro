import ArticleView, { articleMetadata, articleStaticParams } from '../../ArticleView'

// Slug inconnu → 404 (seuls les articles publiés sont générés au build)
export const dynamicParams = false

export function generateStaticParams() {
  return articleStaticParams('philosophie')
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return articleMetadata('philosophie', params.slug)
}

export default function PhilosophieArticlePage({ params }: { params: { slug: string } }) {
  return <ArticleView section="philosophie" slug={params.slug} />
}
