import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only auto-cleans when Vitest globals are enabled, so unmount between tests here.
afterEach(() => {
  cleanup()
})
