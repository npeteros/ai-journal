// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { IMastraLogger } from '@mastra/core/logger'
import type { VoiceTurn } from '@/src/lib/voice'

vi.mock('@/src/mastra', () => ({ mastra: {} }))
vi.mock('@/src/mastra/observability', () => ({ logger: {} }))
vi.mock('@/src/lib/prisma', () => ({ default: {} }))

const { VoiceDraftService, buildVoiceDraftPrompt, userWords } = await import('../VoiceDraftService')

const turns: VoiceTurn[] = [
  { role: 'jaden', text: "Hey Maya, I'm Jaden. How's your day going so far?" },
  { role: 'user', text: "Um, I've been feeling a lot tired lately." },
  { role: 'jaden', text: "What's been weighing on you the most this week?" },
  { role: 'user', text: "I haven't really had rest." },
]

function setup() {
  const callAgent = vi.fn().mockResolvedValue({
    draft: { title: 'Running on empty.', body: "I've been feeling tired lately." },
  })
  const log = { warn: vi.fn(), error: vi.fn() }
  const service = new VoiceDraftService(callAgent, log as unknown as IMastraLogger)
  return { callAgent, log, service }
}

describe('VoiceDraftService', () => {
  it('drafts from the transcript for the signed-in user', async () => {
    const { callAgent, service } = setup()

    await expect(service.draft({ userId: 'user-1', turns })).resolves.toEqual({
      title: 'Running on empty',
      body: "I've been feeling tired lately.",
    })
    expect(callAgent).toHaveBeenCalledWith({
      userId: 'user-1',
      prompt: buildVoiceDraftPrompt(turns),
    })
  })

  it('wraps the transcript in delimiters and labels each speaker', () => {
    expect(buildVoiceDraftPrompt(turns)).toContain(
      "<transcript>\nJaden: Hey Maya, I'm Jaden. How's your day going so far?\nUser: Um, I've been feeling a lot tired lately.",
    )
    expect(buildVoiceDraftPrompt(turns)).toMatch(/<\/transcript>$/)
  })

  it('surfaces the AI rate limit instead of falling back', async () => {
    const { callAgent, service } = setup()
    callAgent.mockResolvedValue({
      tripwire: { processorId: 'ai-usage', metadata: { code: 'TOO_MANY_REQUESTS' } },
    })

    await expect(service.draft({ userId: 'user-1', turns })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    })
  })

  it.each([
    ['the agent throws', () => Promise.reject(new Error('boom'))],
    ['the agent returns no draft', () => Promise.resolve({})],
    ['the draft body is blank', () => Promise.resolve({ draft: { title: 'x', body: '  ' } })],
    [
      'another processor blocks the call',
      () => Promise.resolve({ tripwire: { processorId: 'moderation' } }),
    ],
  ])('falls back to the user words with no title when %s', async (_label, result) => {
    const { callAgent, service } = setup()
    callAgent.mockImplementation(result)

    await expect(service.draft({ userId: 'user-1', turns })).resolves.toEqual({
      body: "Um, I've been feeling a lot tired lately.\n\nI haven't really had rest.",
    })
  })

  it('leaves the title out when the agent returns a blank one', async () => {
    const { callAgent, service } = setup()
    callAgent.mockResolvedValue({ draft: { title: ' ', body: 'Tired.' } })

    await expect(service.draft({ userId: 'user-1', turns })).resolves.toEqual({ body: 'Tired.' })
  })

  it('keeps only the user turns for the fallback body', () => {
    expect(userWords(turns)).not.toContain('Jaden')
  })
})
