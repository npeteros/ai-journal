// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  start: vi.fn(),
}))

vi.mock('@/src/server/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@/src/server/voice/VoiceSessionService', () => ({
  voiceSessionService: { start: mocks.start },
}))

const { POST } = await import('./route')
const { VOICE_LIMIT_CODE, VOICE_SESSION_MAX_BODY_BYTES, VOICE_UNAVAILABLE_CODE } =
  await import('@/src/lib/voice')

const offer = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n'
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/voice/session', { method: 'POST', body, headers })

describe('voice session route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1', name: 'Maya Santos' } })
    mocks.start.mockResolvedValue({ sdp: 'v=0\r\nanswer', usageId: 'usage-1', maxSeconds: 600 })
  })

  it('requires a session', async () => {
    mocks.getSession.mockResolvedValue(null)

    const res = await POST(request(JSON.stringify({ sdp: offer })))

    expect(res.status).toBe(401)
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('starts the session for the signed-in user and returns the answer', async () => {
    const res = await POST(request(JSON.stringify({ sdp: offer, userId: 'someone-else' })))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      sdp: 'v=0\r\nanswer',
      usageId: 'usage-1',
      maxSeconds: 600,
    })
    expect(mocks.start).toHaveBeenCalledWith({
      userId: 'user-1',
      userName: 'Maya Santos',
      sdp: offer,
    })
  })

  it.each([
    ['not JSON', 'nope'],
    ['missing sdp', JSON.stringify({})],
    ['non-string sdp', JSON.stringify({ sdp: 42 })],
    ['not an SDP offer', JSON.stringify({ sdp: 'hello' })],
    ['oversized body', JSON.stringify({ sdp: `v=0${'a'.repeat(VOICE_SESSION_MAX_BODY_BYTES)}` })],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await POST(request(body))

    expect(res.status).toBe(400)
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('rejects a declared oversized body before reading it', async () => {
    const res = await POST(
      request(JSON.stringify({ sdp: offer }), {
        'content-length': String(VOICE_SESSION_MAX_BODY_BYTES + 1),
      }),
    )

    expect(res.status).toBe(400)
  })

  it('returns 429 with the voice limit code when the budget is used up', async () => {
    mocks.start.mockRejectedValue(new TRPCError({ code: 'TOO_MANY_REQUESTS' }))

    const res = await POST(request(JSON.stringify({ sdp: offer })))

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({ code: VOICE_LIMIT_CODE })
  })

  it('returns 502 without OpenAI details when the session cannot be created', async () => {
    mocks.start.mockRejectedValue(
      new Error('GPT-Live session creation failed (500): secret detail'),
    )

    const res = await POST(request(JSON.stringify({ sdp: offer })))

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe(VOICE_UNAVAILABLE_CODE)
    expect(JSON.stringify(body)).not.toContain('secret detail')
  })
})
