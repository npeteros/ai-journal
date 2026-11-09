import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_LOGIN, getSafeRedirect } from '../redirect'

describe('getSafeRedirect', () => {
  it.each(['/chat/abc?x=1', '/journal', '/settings#profile', '/insights/weekly'])(
    'keeps same-origin path %s',
    (path) => {
      expect(getSafeRedirect(path)).toBe(path)
    },
  )

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/foo\\bar',
    'javascript:alert(1)',
    'journal',
    '',
    '/\u0000evil',
    '/login',
    '/register?x=1',
  ])('falls back to the default for %j', (value) => {
    expect(getSafeRedirect(value)).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('falls back for missing or repeated params', () => {
    expect(getSafeRedirect(undefined)).toBe(DEFAULT_AFTER_LOGIN)
    expect(getSafeRedirect(null)).toBe(DEFAULT_AFTER_LOGIN)
    expect(getSafeRedirect(['/chat', '/journal'])).toBe(DEFAULT_AFTER_LOGIN)
  })
})
