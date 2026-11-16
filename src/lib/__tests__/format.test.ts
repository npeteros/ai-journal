import { describe, expect, it } from 'vitest'

import { firstNameOf } from '../format'

describe('firstNameOf', () => {
  it('returns the first word of a full name', () => {
    expect(firstNameOf('Maya Chen')).toBe('Maya')
  })

  it('returns a single name as is', () => {
    expect(firstNameOf('Maya')).toBe('Maya')
  })

  it('ignores surrounding whitespace', () => {
    expect(firstNameOf('  Maya   Chen ')).toBe('Maya')
  })

  it('returns null when no name is set', () => {
    expect(firstNameOf('')).toBeNull()
    expect(firstNameOf('   ')).toBeNull()
  })
})
