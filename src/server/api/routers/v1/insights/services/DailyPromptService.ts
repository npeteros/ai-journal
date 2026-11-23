import { after } from 'next/server'
import prisma from '@/src/lib/prisma'
import {
  DAILY_PROMPT_AGENT_ID,
  DAILY_PROMPT_MAX_SOURCE_ENTRIES,
  DAILY_PROMPT_MODEL,
  DailyPromptOutputSchema,
  buildDailyPromptPrompt,
} from '@/src/mastra/agents/daily-prompt-agent'
import { isAiRateLimited } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { parseDateOnly } from '../../entry/core/queries/shared'
import { toDay } from '../../entry/core/queries/stats'

/** Fewer analyzed entries than this and the user gets a starter prompt instead. */
export const DAILY_PROMPT_MIN_ANALYZED_ENTRIES = 3
export const DAILY_PROMPT_LOCK_TIMEOUT_MS = 5 * 60 * 1000
export const DAILY_PROMPT_FAILURE_COOLDOWN_MS = 6 * 60 * 60 * 1000
export const DAILY_PROMPT_GENERATION_TIMEOUT_MS = 60 * 1000

export const cleanDailyPrompt = (value: string) => value.replace(/\s+/g, ' ').trim()

/** Claims today's row for generation. `day` is "YYYY-MM-DD" in the user's time zone. */
export async function claimDay(userId: string, day: string, claimedAt: Date) {
  const ago = (ms: number) => new Date(claimedAt.getTime() - ms)
  const dayDate = parseDateOnly(day)
  await prisma.dailyPrompt.createMany({ data: [{ userId, day: dayDate }], skipDuplicates: true })
  const claimed = await prisma.dailyPrompt.updateMany({
    where: {
      userId,
      day: dayDate,
      generatedAt: null,
      AND: [
        {
          OR: [{ generatingAt: null }, { generatingAt: { lt: ago(DAILY_PROMPT_LOCK_TIMEOUT_MS) } }],
        },
        { OR: [{ failedAt: null }, { failedAt: { lt: ago(DAILY_PROMPT_FAILURE_COOLDOWN_MS) } }] },
      ],
    },
    data: { generatingAt: claimedAt },
  })
  return claimed.count === 1
}

export async function failDay(userId: string, day: string, claimedAt: Date, error: string) {
  await prisma.dailyPrompt.updateMany({
    where: { userId, day: parseDateOnly(day), generatingAt: claimedAt },
    data: { generatingAt: null, failedAt: new Date(), lastError: error },
  })
}

export async function generateDay(userId: string, day: string, claimedAt: Date) {
  try {
    const rows = await prisma.entry.findMany({
      where: { userId, deletedAt: null, analysis: { isNot: null } },
      select: {
        entryDate: true,
        analysis: { select: { mood: true, moodScore: true, themes: true, summary: true } },
      },
      orderBy: { writtenAt: 'desc' },
      take: DAILY_PROMPT_MAX_SOURCE_ENTRIES,
    })
    const entries = rows.flatMap(({ entryDate, analysis }) =>
      analysis ? [{ date: toDay(entryDate), ...analysis }] : [],
    )
    if (entries.length < DAILY_PROMPT_MIN_ANALYZED_ENTRIES) {
      return failDay(userId, day, claimedAt, 'not_enough_entries')
    }

    const { mastra } = await import('@/src/mastra')
    const result = await mastra
      .getAgentById(DAILY_PROMPT_AGENT_ID)
      .generate(buildDailyPromptPrompt(entries), {
        requestContext: createUserRequestContext(userId),
        structuredOutput: { schema: DailyPromptOutputSchema },
        modelSettings: { timeout: { totalMs: DAILY_PROMPT_GENERATION_TIMEOUT_MS } },
      })
    if (result.tripwire) {
      const code = isAiRateLimited(result.tripwire) ? 'rate_limited' : 'blocked'
      logger.warn('Daily prompt generation blocked', { userId, day, code })
      return failDay(userId, day, claimedAt, code)
    }

    const parsed = DailyPromptOutputSchema.safeParse(result.object)
    const text = parsed.success ? cleanDailyPrompt(parsed.data.prompt) : ''
    if (!text) return failDay(userId, day, claimedAt, 'invalid_output')

    await prisma.dailyPrompt.updateMany({
      where: { userId, day: parseDateOnly(day), generatingAt: claimedAt },
      data: {
        text,
        sourceCount: entries.length,
        model: DAILY_PROMPT_MODEL,
        generatedAt: new Date(),
        generatingAt: null,
        failedAt: null,
        lastError: null,
      },
    })
  } catch (error) {
    logger.warn('Daily prompt generation failed', {
      userId,
      day,
      error: error instanceof Error ? error.message : String(error),
    })
    await failDay(userId, day, claimedAt, 'failed').catch(() => undefined)
  }
}

/** Generates today's prompt after the response is sent, unless another request already is. */
export function scheduleDailyPrompt(userId: string, day: string): void {
  try {
    after(async () => {
      try {
        const claimedAt = new Date()
        if (await claimDay(userId, day, claimedAt)) {
          await generateDay(userId, day, claimedAt)
        }
      } catch (error) {
        logger.warn('Daily prompt could not be claimed', {
          userId,
          day,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  } catch (error) {
    logger.warn('Daily prompt could not be scheduled', {
      userId,
      day,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
