import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Mastra ships native/server-only deps (LibSQL, DuckDB); keep them out of the bundle.
  // Listed explicitly: wildcard entries are not a documented serverExternalPackages feature.
  serverExternalPackages: [
    '@mastra/core',
    '@mastra/ai-sdk',
    '@mastra/duckdb',
    '@mastra/libsql',
    '@mastra/loggers',
    '@mastra/memory',
    '@mastra/observability',
  ],
  experimental: {
    agentUpgrade: 'security',
  },
  async headers() {
    return [
      {
        // Always revalidate the service worker so updates roll out on the next visit.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
