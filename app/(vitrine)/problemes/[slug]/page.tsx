import ArticleView, { articleMetadata, articleStaticParams } from '../../ArticleView'

// Slug inconnu → 404 (seuls les articles publiés sont générés au build)
export const dynamicParams = false

export function generateStaticParams() {
  return articleStaticParams('problemes')
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return articleMetadata('problemes', params.slug)
}

export default function ProblemesArticlePage({ params }: { params: { slug: string } }) {
  return <ArticleView section="problemes" slug={params.slug} />
}
