import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from '../relative-time'

const NOW = new Date('2026-06-15T12:00:00Z')
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000)

describe('formatRelativeTime', () => {
  it('says "Just now" under a minute', () => {
    expect(formatRelativeTime(ago(5), NOW)).toBe('Just now')
  })

  it('uses minutes, hours and days', () => {
    expect(formatRelativeTime(ago(5 * 60), NOW)).toBe('5 minutes ago')
    expect(formatRelativeTime(ago(3 * 3600), NOW)).toBe('3 hours ago')
    expect(formatRelativeTime(ago(24 * 3600), NOW)).toBe('yesterday')
    expect(formatRelativeTime(ago(3 * 86400), NOW)).toBe('3 days ago')
  })

  it('reads a time slightly in the future (clock skew) as "Just now"', () => {
    expect(formatRelativeTime(ago(-3 * 60), NOW)).toBe('Just now')
    expect(formatRelativeTime(ago(-2 * 86400), NOW)).toBe('Just now')
  })

  it('switches to a plain date after a week', () => {
    expect(formatRelativeTime(new Date('2026-05-01T12:00:00Z'), NOW)).toBe('May 1, 2026')
  })
})
