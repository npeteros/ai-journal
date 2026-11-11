import { z } from 'zod'

import { timeZoneSchema } from '../entry/schema'

/** Analyzed entries needed before the Insights screen shows charts instead of an empty state. */
export const INSIGHTS_MIN_ANALYZED_ENTRIES = 3
export const TOP_THEMES_MAX_COUNT = 5
/** Mood mix and top themes cover this many days, ending today in the user's time zone. */
export const RECENT_WINDOW_DAYS = 30

export const InsightsOverviewSchema = z.object({
  timeZone: timeZoneSchema,
})

export type InsightsOverviewInput = z.infer<typeof InsightsOverviewSchema>
