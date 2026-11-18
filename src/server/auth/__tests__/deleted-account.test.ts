// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }))

vi.mock('@/src/lib/prisma', () => ({ default: { user: { findUnique: mocks.findUnique } } }))

const { assertAccountNotDeleted, DELETED_ACCOUNT_MESSAGE } = await import('../deleted-account')

describe('assertAccountNotDeleted', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lets active users through', async () => {
    mocks.findUnique.mockResolvedValue({ deletedAt: null })
    await expect(assertAccountNotDeleted('user-1')).resolves.toBeUndefined()
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { deletedAt: true },
    })
  })

  it('blocks deleted users', async () => {
    mocks.findUnique.mockResolvedValue({ deletedAt: new Date() })
    await expect(assertAccountNotDeleted('user-1')).rejects.toMatchObject({
      body: { message: DELETED_ACCOUNT_MESSAGE },
    })
  })
})
