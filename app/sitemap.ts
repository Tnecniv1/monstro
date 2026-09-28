import type { MetadataRoute } from 'next'
import { getArticles, SECTIONS } from '@/lib/articles'
import { SITE_URL } from '@/lib/site'

// / + /voyage + chaque section ayant au moins un article publié + ses articles.
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/` }, { url: `${SITE_URL}/voyage` }]

  for (const section of SECTIONS) {
    const articles = getArticles(section)
    if (articles.length === 0) continue
    entries.push({ url: `${SITE_URL}/${section}`, lastModified: articles[0].date })
    for (const article of articles) {
      entries.push({ url: `${SITE_URL}/${section}/${article.slug}`, lastModified: article.date })
    }
  }

  return entries
}
