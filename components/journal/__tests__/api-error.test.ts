import { describe, expect, it } from 'vitest'
import { getApiErrorMessage } from '../api-error'

const badRequest = (issues: unknown[]) => ({
  message: JSON.stringify(issues),
  data: { code: 'BAD_REQUEST' },
})

describe('getApiErrorMessage', () => {
  it('explains an empty body', () => {
    const error = badRequest([{ code: 'too_small', path: ['body'], message: 'Too small' }])
    expect(getApiErrorMessage(error)).toBe('Write something before saving.')
  })

  it('explains too many tags and over-long tag names', () => {
    expect(
      getApiErrorMessage(badRequest([{ code: 'too_big', path: ['tags'], message: 'Too big' }])),
    ).toBe('You can add up to 20 tags.')
    expect(
      getApiErrorMessage(badRequest([{ code: 'too_big', path: ['tags', 3], message: 'Too big' }])),
    ).toBe('Tags can be up to 32 characters.')
  })

  it('joins distinct problems and drops duplicates', () => {
    const error = badRequest([
      { code: 'too_small', path: ['body'] },
      { code: 'too_big', path: ['tags'] },
      { code: 'too_small', path: ['body'] },
    ])
    expect(getApiErrorMessage(error)).toBe(
      'Write something before saving. You can add up to 20 tags.',
    )
  })

  it('maps known tRPC codes', () => {
    expect(getApiErrorMessage({ message: 'x', data: { code: 'NOT_FOUND' } })).toBe(
      'This entry no longer exists.',
    )
    expect(getApiErrorMessage({ message: 'x', data: { code: 'UNAUTHORIZED' } })).toBe(
      'Your session has expired. Please sign in again.',
    )
  })

  it('falls back to a generic message for anything else', () => {
    const generic = 'Something went wrong. Please try again.'
    expect(getApiErrorMessage(new Error('Failed to fetch'))).toBe(generic)
    expect(getApiErrorMessage({ message: 'not json', data: { code: 'BAD_REQUEST' } })).toBe(generic)
    expect(getApiErrorMessage(undefined)).toBe(generic)
  })
})
