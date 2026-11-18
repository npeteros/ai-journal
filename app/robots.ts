import type { MetadataRoute } from 'next'

import { PRIVATE_ROUTE_PREFIXES, site } from '@/src/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...PRIVATE_ROUTE_PREFIXES],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  }
}
