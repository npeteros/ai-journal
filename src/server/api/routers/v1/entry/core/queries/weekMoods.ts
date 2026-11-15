import { z } from 'zod'

import type { PrismaClient } from '@/src/generated/prisma/client'
import type { Mood } from '@/src/lib/design-tokens/colors'
import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { timeZoneSchema } from '../../schema'
import { parseDateOnly } from './shared'
import { shiftDay, toDay, toLocalDay } from './stats'

export const weekMoodsInput = z.object({
  timeZone: timeZoneSchema,
})

export type WeekMoodRow = { entryDate: string; mood: Mood; moodScore: number; writtenAt: Date }
export type WeekMoodDay = { entryDate: string; mood: Mood | null }

/**
 * One mood per day for the 7 days ending today (in `timeZone`), oldest first.
 *
 * A day's mood is the mood of its lowest-`moodScore` entry: the hardest moment of the day, so a
 * rough hour isn't hidden behind a good evening. Ties go to the earliest entry. Days without an
 * analyzed entry have `mood: null`.
 */
export function computeWeekMoods(rows: WeekMoodRow[], timeZone: string, now: Date): WeekMoodDay[] {
  const lowestByDay = new Map<string, WeekMoodRow>()
  for (const row of rows) {
    const current = lowestByDay.get(row.entryDate)
    if (
      !current ||
      row.moodScore < current.moodScore ||
      (row.moodScore === current.moodScore && row.writtenAt.getTime() < current.writtenAt.getTime())
    ) {
      lowestByDay.set(row.entryDate, row)
    }
  }

  const today = toLocalDay(now, timeZone)
  return Array.from({ length: 7 }, (_, i) => {
    const entryDate = shiftDay(today, i - 6)
    return { entryDate, mood: lowestByDay.get(entryDate)?.mood ?? null }
  })
}

export async function getWeekMoods(
  db: PrismaClient,
  userId: string,
  { timeZone }: z.infer<typeof weekMoodsInput>,
  now = new Date(),
): Promise<WeekMoodDay[]> {
  const today = toLocalDay(now, timeZone)

  const analyses = await db.entryAnalysis.findMany({
    where: {
      entry: {
        userId,
        deletedAt: null,
        entryDate: { gte: parseDateOnly(shiftDay(today, -6)), lte: parseDateOnly(today) },
      },
    },
    select: {
      mood: true,
      moodScore: true,
      entry: { select: { entryDate: true, writtenAt: true } },
    },
  })

  return computeWeekMoods(
    analyses.map(({ mood, moodScore, entry }) => ({
      entryDate: toDay(entry.entryDate),
      mood,
      moodScore,
      writtenAt: entry.writtenAt,
    })),
    timeZone,
    now,
  )
}

export const weekMoods = protectedProcedure
  .input(weekMoodsInput)
  .query(({ ctx, input }) => getWeekMoods(prisma, ctx.user.id, input))
