import { z } from 'zod'
import type { IMastraLogger } from '@mastra/core/logger'
import { mastra } from '@/src/mastra'
import { VOICE_DRAFT_AGENT_ID } from '@/src/mastra/agents/voice-draft-agent'
import { assertNotRateLimited, type TripwireInfo } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import type { VoiceTurn } from '@/src/lib/voice'
import { BODY_MAX_LENGTH, TITLE_MAX_LENGTH } from '../../entry/schema'

const draftOutputSchema = z.object({ title: z.string(), body: z.string() })

export type VoiceDraft = {
  /** Undefined when drafting fell back; saving without a title lets the entry title service add one. */
  title?: string
  body: string
}

export type DraftAgentResult = {
  draft?: { title: string; body: string }
  tripwire?: TripwireInfo
}

export type DraftAgentCall = (input: {
  userId: string
  prompt: string
}) => Promise<DraftAgentResult>

const callVoiceDraftAgent: DraftAgentCall = async ({ userId, prompt }) => {
  const result = await mastra.getAgentById(VOICE_DRAFT_AGENT_ID).generate(prompt, {
    requestContext: createUserRequestContext(userId),
    structuredOutput: { schema: draftOutputSchema },
  })
  return { draft: result.object ?? undefined, tripwire: result.tripwire }
}

/** Wraps the transcript in delimiters so the agent treats it as data, not instructions. */
export function buildVoiceDraftPrompt(turns: VoiceTurn[]): string {
  const transcript = turns
    .map(({ role, text }) => `${role === 'user' ? 'User' : 'Jaden'}: ${text}`)
    .join('\n')
  return `Write a draft journal entry from this conversation.\n\n<transcript>\n${transcript}\n</transcript>`
}

/** The user's own words, used as the body when the agent can't draft. */
export function userWords(turns: VoiceTurn[]): string {
  return turns
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text.trim())
    .join('\n\n')
}

const capLength = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max))

/**
 * Turns a journaling conversation into a draft entry for the user to review. Throws
 * TOO_MANY_REQUESTS when the user is over the AI limit; any other failure falls back to the
 * user's own words with no title, so the conversation is never lost.
 */
export class VoiceDraftService {
  constructor(
    private readonly callAgent: DraftAgentCall = callVoiceDraftAgent,
    private readonly log: IMastraLogger = logger,
  ) {}

  async draft({ userId, turns }: { userId: string; turns: VoiceTurn[] }): Promise<VoiceDraft> {
    const fallback = { body: capLength(userWords(turns), BODY_MAX_LENGTH) }

    let result: DraftAgentResult
    try {
      result = await this.callAgent({ userId, prompt: buildVoiceDraftPrompt(turns) })
    } catch (error) {
      this.log.error('Voice draft generation failed; using the transcript', { userId, error })
      return fallback
    }

    assertNotRateLimited(result)

    const title = result.draft?.title.trim().replace(/\.+$/, '') ?? ''
    const body = result.draft?.body.trim() ?? ''
    if (result.tripwire || body === '') {
      this.log.warn('Voice draft generation returned nothing usable; using the transcript', {
        userId,
        processorId: result.tripwire?.processorId,
      })
      return fallback
    }

    return {
      title: title === '' ? undefined : capLength(title, TITLE_MAX_LENGTH),
      body: capLength(body, BODY_MAX_LENGTH),
    }
  }
}

export const voiceDraftService = new VoiceDraftService()
