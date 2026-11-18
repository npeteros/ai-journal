import type { MetadataRoute } from 'next'

import { site } from '@/src/lib/site'

// Only public marketing/auth pages. Journal, chat and other signed-in routes are private.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/register`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${site.url}/login`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
