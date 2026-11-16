// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { ALLOWED_CLIENT_EVENTS, GPT_LIVE_SESSIONS_URL, LiveSessionError, createLiveSession } =
  await import('../gpt-live')

const input = {
  sdp: 'v=0\r\noffer',
  instructions: 'You are Jaden.',
  greeting: 'Greet the user by their first name, Maya.',
  safetyIdentifier: 'hashed-user',
}

const json = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function setup(
  response: Response | Error = json({
    session: { id: 'live_1' },
    transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' },
  }),
) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  return { fetchImpl }
}

describe('createLiveSession', () => {
  it('creates the session server-side with fixed instructions and locked-down client events', async () => {
    const { fetchImpl } = setup()

    await expect(createLiveSession(input, fetchImpl, 'sk-test')).resolves.toEqual({
      sessionId: 'live_1',
      sdp: 'v=0\r\nanswer',
    })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(GPT_LIVE_SESSIONS_URL)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      session: {
        model: 'gpt-live-1',
        instructions: 'You are Jaden.',
        audio: { output: { voice: 'marin' } },
        input: [
          {
            type: 'message',
            role: 'developer',
            content: [{ type: 'input_text', text: 'Greet the user by their first name, Maya.' }],
          },
        ],
        safety_identifier: 'hashed-user',
        client: {
          data_channel: { allowed_client_events: ['session.close', 'session.commentary.append'] },
        },
      },
      transport: { type: 'webrtc', sdp: 'v=0\r\noffer' },
    })
  })

  it('only lets the browser close the session or cue the greeting', () => {
    expect([...ALLOWED_CLIENT_EVENTS]).toEqual(['session.close', 'session.commentary.append'])
  })

  it('fails without an API key and never calls OpenAI', async () => {
    const { fetchImpl } = setup()

    await expect(createLiveSession(input, fetchImpl, undefined)).rejects.toBeInstanceOf(
      LiveSessionError,
    )
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports OpenAI errors with their status', async () => {
    const { fetchImpl } = setup(json({ error: { message: 'bad' } }, 400))

    await expect(createLiveSession(input, fetchImpl, 'sk-test')).rejects.toMatchObject({
      name: 'LiveSessionError',
      status: 400,
    })
  })

  it('reports network failures', async () => {
    const { fetchImpl } = setup(new Error('ECONNRESET'))

    await expect(createLiveSession(input, fetchImpl, 'sk-test')).rejects.toBeInstanceOf(
      LiveSessionError,
    )
  })

  it.each([
    ['no SDP answer', { session: { id: 'live_1' }, transport: {} }],
    ['no session ID', { session: {}, transport: { sdp: 'v=0' } }],
    ['not JSON', 'nope'],
  ])('rejects a success response with %s', async (_label, body) => {
    const response = typeof body === 'string' ? new Response(body, { status: 201 }) : json(body)
    const { fetchImpl } = setup(response)

    await expect(createLiveSession(input, fetchImpl, 'sk-test')).rejects.toBeInstanceOf(
      LiveSessionError,
    )
  })
})
