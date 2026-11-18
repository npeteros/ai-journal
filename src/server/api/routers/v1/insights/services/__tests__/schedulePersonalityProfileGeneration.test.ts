// @vitest-environment node
import type { IMastraLogger } from '@mastra/core/logger'
import { describe, expect, it, vi } from 'vitest'
import { schedulePersonalityProfileGeneration } from '../schedulePersonalityProfileGeneration'

const CLAIMED_AT = new Date('2026-11-18T12:00:00.000Z')
const log = { warn: vi.fn() } as unknown as IMastraLogger

describe('schedulePersonalityProfileGeneration', () => {
  it('does not await background work while scheduling a claimed run', () => {
    const schedule = vi.fn()
    const runWorkflow = vi.fn().mockResolvedValue(undefined)

    schedulePersonalityProfileGeneration('user-1', CLAIMED_AT, schedule, runWorkflow, vi.fn(), log)

    expect(schedule).toHaveBeenCalledOnce()
    expect(runWorkflow).not.toHaveBeenCalled()
  })

  it('fences a scheduler failure to the original claim', async () => {
    const failClaim = vi.fn().mockResolvedValue(undefined)
    const schedule = vi.fn(() => {
      throw new Error('route closed')
    })

    schedulePersonalityProfileGeneration('user-1', CLAIMED_AT, schedule, vi.fn(), failClaim, log)
    await vi.waitFor(() => expect(failClaim).toHaveBeenCalledWith('user-1', CLAIMED_AT))
  })
})
