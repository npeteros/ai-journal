import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Evals call the real model and cost tokens, so they run only via `npm run eval`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    // Load .env (OPENAI_API_KEY etc.) — Vitest doesn't do this by default.
    env: loadEnv('', process.cwd(), ''),
    include: ['src/mastra/evals/**/*.eval.ts'],
    testTimeout: 300_000,
  },
})
