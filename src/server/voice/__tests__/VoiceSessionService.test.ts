// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import type { IMastraLogger } from '@mastra/core/logger'

vi.mock('server-only', () => ({}))
vi.mock('@/src/lib/prisma', () => ({ default: {} }))
vi.mock('@/src/mastra/observability', () => ({ logger: {} }))

const { VoiceSessionService, voiceSafetyIdentifier } = await import('../VoiceSessionService')
const { LiveSessionError } = await import('../gpt-live')
const { VOICE_SESSION_INSTRUCTIONS } = await import('../instructions')

function setup() {
  const usage = {
    reserveVoiceSession: vi.fn().mockResolvedValue('usage-1'),
    finalizeVoiceSession: vi.fn().mockResolvedValue(true),
  }
  const createSession = vi.fn().mockResolvedValue({ sessionId: 'live_1', sdp: 'v=0\r\nanswer' })
  const log = { info: vi.fn(), error: vi.fn() }
  const service = new VoiceSessionService(usage, createSession, log as unknown as IMastraLogger)
  return { usage, createSession, log, service }
}

const input = { userId: 'user-1', userName: 'Maya Santos', sdp: 'v=0\r\noffer' }

describe('VoiceSessionService', () => {
  it('reserves the voice budget, then creates the session and returns only the answer', async () => {
    const { usage, createSession, service } = setup()

    await expect(service.start(input)).resolves.toEqual({
      sdp: 'v=0\r\nanswer',
      usageId: 'usage-1',
      maxSeconds: 600,
    })
    expect(usage.reserveVoiceSession).toHaveBeenCalledWith('user-1')
    expect(usage.reserveVoiceSession.mock.invocationCallOrder[0]).toBeLessThan(
      createSession.mock.invocationCallOrder[0],
    )
    expect(createSession).toHaveBeenCalledWith({
      sdp: 'v=0\r\noffer',
      instructions: VOICE_SESSION_INSTRUCTIONS,
      greeting: expect.stringContaining('by their first name, Maya'),
      safetyIdentifier: voiceSafetyIdentifier('user-1'),
    })
  })

  it('greets without a name when the user has none', async () => {
    const { createSession, service } = setup()

    await service.start({ ...input, userName: '' })

    expect(createSession.mock.calls[0][0].greeting).toContain('you do not know their name')
  })

  it('never sends the raw user ID to OpenAI', async () => {
    const { createSession, service } = setup()

    await service.start(input)

    const sent = createSession.mock.calls[0][0].safetyIdentifier
    expect(sent).toMatch(/^[0-9a-f]{64}$/)
    expect(sent).not.toContain('user-1')
  })

  it('does not create a session when the voice budget is used up', async () => {
    const { usage, createSession, service } = setup()
    usage.reserveVoiceSession.mockRejectedValue(new TRPCError({ code: 'TOO_MANY_REQUESTS' }))

    await expect(service.start(input)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    expect(createSession).not.toHaveBeenCalled()
  })

  it('records the reserved row as failed when OpenAI fails, then rethrows', async () => {
    const { usage, createSession, service } = setup()
    const error = new LiveSessionError('boom', 500)
    createSession.mockRejectedValue(error)

    await expect(service.start(input)).rejects.toBe(error)
    expect(usage.finalizeVoiceSession).toHaveBeenCalledWith({
      usageId: 'usage-1',
      userId: 'user-1',
      seconds: 0,
      success: false,
    })
  })
})
