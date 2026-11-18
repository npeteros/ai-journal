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

export const STORY_PAGE_MONTHS = 6
export const STORY_QUOTE_MAX_LENGTH = 120

export const STORY_MOOD_WORDS = {
  calm: 'calm',
  grateful: 'grateful',
  tired: 'tired',
  anxious: 'anxious',
  hard: 'hard days',
} as const

export type StoryMood = keyof typeof STORY_MOOD_WORDS

export const storyLine = (entryCount: number, mood: StoryMood | null) =>
  `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}${mood ? ` · mostly ${STORY_MOOD_WORDS[mood]}` : ''}`

export const StorySchema = z.object({
  timeZone: timeZoneSchema,
  cursor: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullish(),
})

export type StoryInput = z.infer<typeof StorySchema>
