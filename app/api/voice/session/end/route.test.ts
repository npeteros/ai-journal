// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  finalizeVoiceSession: vi.fn(),
}))

vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@/src/mastra/guardrails/AiUsageService', () => ({
  aiUsageService: { finalizeVoiceSession: mocks.finalizeVoiceSession },
}))

const { POST } = await import('./route')

const usageId = '7f8c1f4e-2b1a-4c1e-9d55-0a2b3c4d5e6f'
const request = (body: string) =>
  new Request('http://localhost/api/voice/session/end', { method: 'POST', body })

describe('voice session end route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.finalizeVoiceSession.mockResolvedValue(true)
  })

  it('requires a session', async () => {
    mocks.getSession.mockResolvedValue(null)

    const res = await POST(request(JSON.stringify({ usageId, seconds: 30 })))

    expect(res.status).toBe(401)
    expect(mocks.finalizeVoiceSession).not.toHaveBeenCalled()
  })

  it('records the reported length against the signed-in user only', async () => {
    const res = await POST(request(JSON.stringify({ usageId, seconds: 91.4, userId: 'other' })))

    expect(res.status).toBe(204)
    expect(mocks.finalizeVoiceSession).toHaveBeenCalledWith({
      usageId,
      userId: 'user-1',
      seconds: 91.4,
      success: true,
    })
  })

  it('accepts a sendBeacon text/plain body', async () => {
    const res = await POST(
      new Request('http://localhost/api/voice/session/end', {
        method: 'POST',
        body: new Blob([JSON.stringify({ usageId, seconds: 12 })], { type: 'text/plain' }),
      }),
    )

    expect(res.status).toBe(204)
  })

  it.each([
    ['not JSON', 'nope'],
    ['a non-UUID usage ID', JSON.stringify({ usageId: 'abc', seconds: 1 })],
    ['negative seconds', JSON.stringify({ usageId, seconds: -1 })],
    ['missing seconds', JSON.stringify({ usageId })],
    ['an oversized body', JSON.stringify({ usageId, seconds: 1, pad: 'x'.repeat(2000) })],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await POST(request(body))

    expect(res.status).toBe(400)
    expect(mocks.finalizeVoiceSession).not.toHaveBeenCalled()
  })
})
