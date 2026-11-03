import { z } from 'zod'
import type { IMastraLogger } from '@mastra/core/logger'
import { mastra } from '@/src/mastra'
import { ENTRY_TITLE_AGENT_ID } from '@/src/mastra/agents/entry-title-agent'
import { isAiRateLimited, type TripwireInfo } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { TITLE_MAX_LENGTH } from '../schema'

const FALLBACK_TITLE_WORDS = 6
const ELLIPSIS = '…'

const titleOutputSchema = z.object({ title: z.string() })

export type GenerateTitleInput = {
  userId: string
  body: string
}

export type TitleAgentResult = {
  title?: string
  tripwire?: TripwireInfo
}

export type TitleAgentCall = (input: GenerateTitleInput) => Promise<TitleAgentResult>

const callEntryTitleAgent: TitleAgentCall = async ({ userId, body }) => {
  const result = await mastra.getAgentById(ENTRY_TITLE_AGENT_ID).generate(body, {
    requestContext: createUserRequestContext(userId),
    structuredOutput: { schema: titleOutputSchema },
  })
  return { title: result.object?.title, tripwire: result.tripwire }
}

function capLength(title: string): string {
  if (title.length <= TITLE_MAX_LENGTH) return title
  return `${title.slice(0, TITLE_MAX_LENGTH - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`
}

function cleanTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generates titles for journal entries saved without one. `entry.title` is NOT NULL,
 * so `generate()` always returns a usable title and never throws: if the AI call is
 * rate limited, fails or returns nothing, it falls back to the start of the body.
 */
export class EntryTitleService {
  constructor(
    private readonly callAgent: TitleAgentCall = callEntryTitleAgent,
    private readonly log: IMastraLogger = logger,
  ) {}

  async generate(input: GenerateTitleInput): Promise<string> {
    try {
      const { title, tripwire } = await this.callAgent(input)

      if (tripwire) {
        this.log.warn('Entry title generation blocked; using fallback title', {
          userId: input.userId,
          rateLimited: isAiRateLimited(tripwire),
          processorId: tripwire.processorId,
        })
        return this.fallbackTitle(input.body)
      }

      const cleaned = cleanTitle(title ?? '')
      if (cleaned === '') {
        this.log.warn('Entry title generation returned an empty title; using fallback title', {
          userId: input.userId,
        })
        return this.fallbackTitle(input.body)
      }

      return capLength(cleaned)
    } catch (error) {
      this.log.warn('Entry title generation failed; using fallback title', {
        userId: input.userId,
        error: error instanceof Error ? error.message : String(error),
      })
      return this.fallbackTitle(input.body)
    }
  }

  fallbackTitle(body: string): string {
    const words = body.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return 'Untitled entry'

    const title = words.slice(0, FALLBACK_TITLE_WORDS).join(' ')
    return capLength(words.length > FALLBACK_TITLE_WORDS ? `${title}${ELLIPSIS}` : title)
  }
}

export const entryTitleService = new EntryTitleService()
