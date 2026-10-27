import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mastra ships native/server-only deps (LibSQL, DuckDB); keep them out of the bundle.
  // Listed explicitly: wildcard entries are not a documented serverExternalPackages feature.
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/ai-sdk",
    "@mastra/duckdb",
    "@mastra/libsql",
    "@mastra/loggers",
    "@mastra/memory",
    "@mastra/observability",
  ],
};

export default nextConfig;
