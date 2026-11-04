import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Evals hit the real model; they run separately via `npm run eval`.
    exclude: [...configDefaults.exclude, '**/*.eval.ts'],
  },
})
