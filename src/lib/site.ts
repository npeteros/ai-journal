/**
 * Site-wide identity used by metadata, the web app manifest, robots, sitemap and OG images.
 */

function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export const site = {
  name: 'JADEN',
  title: 'JADEN — Reflect deeper, every day',
  tagline: 'Reflect deeper, every day.',
  description:
    'JADEN pairs a calm daily journal with frontier AI — richer reflection, pattern detection, and insight than a simple notes app. Private, exportable, and never used to train models.',
  keywords: [
    'journal',
    'AI journal',
    'journaling app',
    'reflection',
    'mood tracker',
    'self-reflection',
    'private journal',
    'mental wellbeing',
  ],
  url: resolveSiteUrl(),
  /** Paper (--bg) and ink (--ink) as hex, for places that can't read CSS variables. */
  colors: {
    paper: '#fbf6ec',
    paperDark: '#130f0a',
    surface: '#fffdf9',
    ink: '#1e1a14',
    inkMuted: '#67625c',
    sageTint: '#d9f6dd',
    cloudTint: '#daefff',
  },
} as const

/** Routes that are public and worth indexing. Everything else is private or utility. */
export const PUBLIC_ROUTES = ['/', '/register', '/login'] as const

/** Private (signed-in) and internal routes that crawlers should skip. */
export const PRIVATE_ROUTE_PREFIXES = [
  '/journal',
  '/chat',
  '/frameworks',
  '/insights',
  '/settings',
  '/api',
  '/dev',
] as const
