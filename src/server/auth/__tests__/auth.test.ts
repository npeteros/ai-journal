// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/prisma', () => ({ default: {} }))

const { previewOrigins } = await import('../auth')

describe('previewOrigins', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('trusts the deployment URL and branch alias on preview deployments', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_URL', 'jaden-ai-abc123-team.vercel.app')
    vi.stubEnv('VERCEL_BRANCH_URL', 'jaden-ai-git-s4-10-team.vercel.app')

    expect(previewOrigins()).toEqual([
      'https://jaden-ai-abc123-team.vercel.app',
      'https://jaden-ai-git-s4-10-team.vercel.app',
    ])
  })

  it('skips hostnames Vercel did not set', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_URL', 'jaden-ai-abc123-team.vercel.app')
    vi.stubEnv('VERCEL_BRANCH_URL', '')

    expect(previewOrigins()).toEqual(['https://jaden-ai-abc123-team.vercel.app'])
  })

  it.each(['production', 'development', undefined])(
    'trusts nothing extra when VERCEL_ENV is %s',
    (env) => {
      vi.stubEnv('VERCEL_ENV', env)
      vi.stubEnv('VERCEL_URL', 'jaden-ai-abc123-team.vercel.app')

      expect(previewOrigins()).toEqual([])
    },
  )
})
