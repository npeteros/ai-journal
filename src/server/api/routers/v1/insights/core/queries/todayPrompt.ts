import { z } from 'zod'
import { STARTER_PROMPT_SOURCE, starterPrompt } from '@/src/lib/daily-prompt-starters'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { parseDateOnly } from '../../../entry/core/queries/shared'
import { toLocalDay } from '../../../entry/core/queries/stats'
import { timeZoneSchema } from '../../../entry/schema'
import {
  DAILY_PROMPT_MIN_ANALYZED_ENTRIES,
  scheduleDailyPrompt,
} from '../../services/DailyPromptService'

export const todayPromptInput = z.object({ timeZone: timeZoneSchema })

export type TodayPrompt = {
  text: string
  source: string
  kind: 'ai' | 'starter'
}

export const aiPromptSource = (count: number) =>
  `From your last ${count} ${count === 1 ? 'entry' : 'entries'}`

/**
 * Today's journaling prompt. Returns the stored AI prompt for the user's local day, or a starter
 * prompt while there is none, and schedules generation in the background once the user has
 * enough analyzed entries.
 */
export async function getTodayPrompt(
  userId: string,
  { timeZone }: z.infer<typeof todayPromptInput>,
  now = new Date(),
): Promise<TodayPrompt> {
  const day = toLocalDay(now, timeZone)
  const starter: TodayPrompt = {
    text: starterPrompt(day),
    source: STARTER_PROMPT_SOURCE,
    kind: 'starter',
  }

  const row = await prisma.dailyPrompt.findUnique({
    where: { userId_day: { userId, day: parseDateOnly(day) } },
    select: { text: true, sourceCount: true, generatedAt: true },
  })
  if (row?.text && row.generatedAt) {
    return { text: row.text, source: aiPromptSource(row.sourceCount ?? 0), kind: 'ai' }
  }

  const analyzed = await prisma.entryAnalysis.count({
    where: { entry: { userId, deletedAt: null } },
  })
  if (analyzed >= DAILY_PROMPT_MIN_ANALYZED_ENTRIES) scheduleDailyPrompt(userId, day)
  return starter
}

export const todayPrompt = protectedProcedure
  .input(todayPromptInput)
  .query(({ ctx, input }) => getTodayPrompt(ctx.user.id, input))
