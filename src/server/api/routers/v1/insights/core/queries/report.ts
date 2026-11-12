import prisma from '@/src/lib/prisma'
import { protectedProcedure } from '@/src/server/trpc/init'
import { InsightReportOutputSchema } from '../../report-schema'

export type StoredInsightReport = {
  recurringThemes: {
    title: string
    mentions: number
    trend: 'rising' | 'steady' | 'falling'
    entryIds: string[]
  }[]
  growthSuggestions: { title: string; body: string; short: string; entryIds: string[] }[]
  trendCaption: string | null
  periodStart: Date
  periodEnd: Date
  entryCount: number
  createdAt: Date
}

/** Returns the newest valid report owned by the signed-in user; malformed historical JSON is hidden. */
export const report = protectedProcedure.query(
  async ({ ctx }): Promise<StoredInsightReport | null> => {
    const stored = await prisma.insightReport.findFirst({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        recurringThemes: true,
        growthSuggestions: true,
        trendCaption: true,
        periodStart: true,
        periodEnd: true,
        entryCount: true,
        createdAt: true,
      },
    })
    if (!stored) return null

    const parsed = InsightReportOutputSchema.safeParse({
      recurringThemes: stored.recurringThemes,
      growthSuggestions: stored.growthSuggestions,
      trendCaption: stored.trendCaption,
    })
    if (!parsed.success) return null

    return { ...stored, ...parsed.data }
  },
)
