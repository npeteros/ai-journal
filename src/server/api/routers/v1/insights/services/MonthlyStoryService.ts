import { after } from 'next/server'
import type { Mood } from '@/src/generated/prisma/client'
import prisma from '@/src/lib/prisma'
import {
  MONTHLY_STORY_AGENT_ID,
  MONTHLY_STORY_MAX_SOURCE_ENTRIES,
  MONTHLY_STORY_MODEL,
  MonthlyStoryOutputSchema,
  buildMonthlyStoryPrompt,
} from '@/src/mastra/agents/monthly-story-agent'
import { isAiRateLimited } from '@/src/mastra/guardrails/AiUsageProcessor'
import { createUserRequestContext } from '@/src/mastra/guardrails/requestContext'
import { logger } from '@/src/mastra/observability'
import { monthStart, shiftMonth, toDay } from '../../entry/core/queries/stats'

export const MONTHLY_STORY_LOCK_TIMEOUT_MS = 5 * 60 * 1000
export const MONTHLY_STORY_FAILURE_COOLDOWN_MS = 6 * 60 * 60 * 1000
export const MONTHLY_STORY_GENERATION_TIMEOUT_MS = 2 * 60 * 1000
export const MONTHLY_STORY_MAX_GENERATIONS_PER_REQUEST = 2

export type MissingMonthlyStory = {
  month: string
  mood: Mood | null
  entryCount: number
  fingerprint: string
}

export const cleanMonthlySummary = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,\s]+|[.\s]+$/g, '')

export function sampleAcrossMonth<T>(items: T[], max = MONTHLY_STORY_MAX_SOURCE_ENTRIES) {
  if (items.length <= max) return items
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]!)
}

export async function claimMonth(
  userId: string,
  { month, fingerprint }: MissingMonthlyStory,
  claimedAt: Date,
) {
  const ago = (ms: number) => new Date(claimedAt.getTime() - ms)
  await prisma.monthlyStory.createMany({ data: [{ userId, month }], skipDuplicates: true })
  const claimed = await prisma.monthlyStory.updateMany({
    where: {
      userId,
      month,
      AND: [
        {
          OR: [{ generatedAt: null }, { fingerprint: null }, { fingerprint: { not: fingerprint } }],
        },
        {
          OR: [
            { generatingAt: null },
            { generatingAt: { lt: ago(MONTHLY_STORY_LOCK_TIMEOUT_MS) } },
          ],
        },
        { OR: [{ failedAt: null }, { failedAt: { lt: ago(MONTHLY_STORY_FAILURE_COOLDOWN_MS) } }] },
      ],
    },
    data: { generatingAt: claimedAt },
  })
  return claimed.count === 1
}

export async function failMonth(userId: string, month: string, claimedAt: Date, error: string) {
  await prisma.monthlyStory.updateMany({
    where: { userId, month, generatingAt: claimedAt },
    data: { generatingAt: null, failedAt: new Date(), lastError: error },
  })
}

export async function generateMonth(userId: string, story: MissingMonthlyStory, claimedAt: Date) {
  const { month, mood, entryCount, fingerprint } = story
  try {
    const rows = await prisma.entry.findMany({
      where: {
        userId,
        deletedAt: null,
        entryDate: { gte: monthStart(month), lt: monthStart(shiftMonth(month, 1)) },
        analysis: { isNot: null },
      },
      select: {
        entryDate: true,
        analysis: { select: { mood: true, moodScore: true, themes: true, summary: true } },
      },
      orderBy: [{ entryDate: 'asc' }, { writtenAt: 'asc' }],
    })
    const entries = sampleAcrossMonth(
      rows.flatMap(({ entryDate, analysis }) =>
        analysis ? [{ date: toDay(entryDate), ...analysis }] : [],
      ),
    )
    if (entries.length === 0) return failMonth(userId, month, claimedAt, 'no_analyzed_entries')

    const { mastra } = await import('@/src/mastra')
    const result = await mastra
      .getAgentById(MONTHLY_STORY_AGENT_ID)
      .generate(buildMonthlyStoryPrompt(month, entryCount, mood, entries), {
        requestContext: createUserRequestContext(userId),
        structuredOutput: { schema: MonthlyStoryOutputSchema },
        modelSettings: { timeout: { totalMs: MONTHLY_STORY_GENERATION_TIMEOUT_MS } },
      })
    if (result.tripwire) {
      const code = isAiRateLimited(result.tripwire) ? 'rate_limited' : 'blocked'
      logger.warn('Monthly story generation blocked', { userId, month, code })
      return failMonth(userId, month, claimedAt, code)
    }

    const parsed = MonthlyStoryOutputSchema.safeParse(result.object)
    const summary = parsed.success ? cleanMonthlySummary(parsed.data.summary) : ''
    if (!summary) return failMonth(userId, month, claimedAt, 'invalid_output')

    await prisma.monthlyStory.updateMany({
      where: { userId, month, generatingAt: claimedAt },
      data: {
        summary,
        fingerprint,
        model: MONTHLY_STORY_MODEL,
        generatedAt: new Date(),
        generatingAt: null,
        failedAt: null,
        lastError: null,
      },
    })
  } catch (error) {
    logger.warn('Monthly story generation failed', {
      userId,
      month,
      error: error instanceof Error ? error.message : String(error),
    })
    await failMonth(userId, month, claimedAt, 'failed').catch(() => undefined)
  }
}

export function scheduleMonthlyStories(userId: string, months: MissingMonthlyStory[]): void {
  const queued = months.slice(0, MONTHLY_STORY_MAX_GENERATIONS_PER_REQUEST)
  if (queued.length === 0) return
  try {
    after(async () => {
      for (const story of queued) {
        try {
          const claimedAt = new Date()
          if (await claimMonth(userId, story, claimedAt)) {
            await generateMonth(userId, story, claimedAt)
          }
        } catch (error) {
          logger.warn('Monthly story could not be claimed', {
            userId,
            month: story.month,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    })
  } catch (error) {
    logger.warn('Monthly stories could not be scheduled', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
