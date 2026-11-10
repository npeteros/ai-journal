import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const allowSyntheticContentLogging =
  process.env.EVAL_ISOLATED_HARNESS === 'true' && process.env.EVAL_LOG_SYNTHETIC_CONTENT === 'true'

// Evals call the real model and cost tokens, so they run only via `npm run eval`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    // Load .env (OPENAI_API_KEY etc.) — Vitest doesn't do this by default.
    env: {
      ...loadEnv('', process.cwd(), ''),
      // Synthetic response text is retained only when an isolated harness explicitly opts in.
      AI_LOG_CONTENT: allowSyntheticContentLogging ? 'true' : 'false',
    },
    include: ['src/mastra/evals/**/*.eval.ts'],
    // Fixture-backed evals use one deterministic in-memory data source at a time.
    fileParallelism: false,
    testTimeout: 300_000,
  },
})
