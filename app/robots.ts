import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Pages publiques autorisées ; zones connectées et admin exclues.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/agora',
        '/apprendre',
        '/bibliotheque',
        '/classement',
        '/dashboard',
        '/entrainement',
        '/forum',
        '/login',
        '/mission',
        '/parcours',
        '/profil',
        '/viewer',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
