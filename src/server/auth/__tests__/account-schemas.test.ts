import { describe, expect, it } from 'vitest'

import { changePasswordSchema } from '../schemas/change-password'
import { deleteAccountSchema } from '../schemas/delete-account'

const validChange = {
  currentPassword: 'oldpass123',
  newPassword: 'newpass456',
  confirm: 'newpass456',
  revokeOtherSessions: true,
}

describe('changePasswordSchema', () => {
  it('accepts a valid change', () => {
    expect(changePasswordSchema.safeParse(validChange).success).toBe(true)
  })

  it('applies the registration password rules', () => {
    const short = changePasswordSchema.safeParse({
      ...validChange,
      newPassword: 'a1',
      confirm: 'a1',
    })
    const noDigit = changePasswordSchema.safeParse({
      ...validChange,
      newPassword: 'longenough',
      confirm: 'longenough',
    })
    expect(short.success).toBe(false)
    expect(noDigit.success).toBe(false)
  })

  it('requires the current password', () => {
    expect(changePasswordSchema.safeParse({ ...validChange, currentPassword: '' }).success).toBe(
      false,
    )
  })

  it('requires the confirmation to match', () => {
    const result = changePasswordSchema.safeParse({ ...validChange, confirm: 'different1' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirm'])
  })

  it('rejects reusing the current password', () => {
    const result = changePasswordSchema.safeParse({
      ...validChange,
      newPassword: 'oldpass123',
      confirm: 'oldpass123',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['newPassword'])
  })
})

describe('deleteAccountSchema', () => {
  it('needs the password and the exact word DELETE', () => {
    expect(deleteAccountSchema.safeParse({ password: 'pw', confirmation: 'DELETE' }).success).toBe(
      true,
    )
    expect(deleteAccountSchema.safeParse({ password: '', confirmation: 'DELETE' }).success).toBe(
      false,
    )
    expect(deleteAccountSchema.safeParse({ password: 'pw', confirmation: 'delete' }).success).toBe(
      false,
    )
  })
})
