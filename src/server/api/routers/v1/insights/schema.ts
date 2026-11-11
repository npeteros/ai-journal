import { z } from 'zod'

/** Analyzed entries needed before the Insights screen shows charts instead of an empty state. */
export const INSIGHTS_MIN_ANALYZED_ENTRIES = 3
export const TOP_THEMES_MAX_COUNT = 5

const timeZoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value })
      return true
    } catch {
      return false
    }
  },
  { message: 'Invalid IANA time zone' },
)

export const InsightsOverviewSchema = z.object({
  timeZone: timeZoneSchema,
})

export type InsightsOverviewInput = z.infer<typeof InsightsOverviewSchema>
