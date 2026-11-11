/**
 * PLACEHOLDER DATA — mock insights for the UI build.
 * Replace with the insights / analytics tRPC procedures.
 * Chart values are 0–100 mood scores (higher = better).
 */
import type { Mood } from '@/src/lib/design-tokens/colors'
import type { Trend } from '@/components/ui/data'

export const moodThisWeek = [
  { label: 'Mon', value: 50 },
  { label: 'Tue', value: 71 },
  { label: 'Wed', value: 39 },
  { label: 'Thu', value: 79 },
  { label: 'Fri', value: 29 },
  { label: 'Sat', value: 61 },
  { label: 'Sun', value: 46 },
]

export const moodMix: { mood: Mood; count: number }[] = [
  { mood: 'calm', count: 8 },
  { mood: 'grateful', count: 6 },
  { mood: 'tired', count: 4 },
  { mood: 'anxious', count: 3 },
]

export const topThemes = [
  { label: 'Work', pct: 78 },
  { label: 'Family', pct: 52 },
  { label: 'Gratitude', pct: 40 },
]

export const recurringThemes: { title: string; mentions: number; trend: Trend }[] = [
  { title: 'Wanting clearer boundaries at work', mentions: 9, trend: 'rising' },
  { title: 'Gratitude for slower mornings', mentions: 14, trend: 'steady' },
  { title: 'Reconnecting with old friends', mentions: 5, trend: 'rising' },
]

export const personality = {
  basedOn: 62,
  updated: 'Aug 20',
  traits: [
    { trait: 'Openness', level: 'High', pct: 82 },
    { trait: 'Conscientiousness', level: 'Moderate', pct: 58 },
    { trait: 'Extraversion', level: 'Low', pct: 30 },
    { trait: 'Agreeableness', level: 'High', pct: 76 },
    { trait: 'Emotional stability', level: 'Moderate', pct: 54 },
  ],
  summary:
    'You write with curiosity and warmth toward others, but tend to process big feelings alone first.',
  meaning:
    'You write with curiosity and warmth toward others, but tend to process big feelings alone before sharing them — journaling seems to be doing real work here.',
}

/** Desktop snapshot shows three traits. */
export const personalitySnapshot = ['Openness', 'Agreeableness', 'Extraversion'].flatMap((name) =>
  personality.traits.filter((t) => t.trait === name),
)

export const growthSuggestions = [
  {
    title: 'Try a Sunday wind-down ritual',
    body: 'Your Monday entries are calmer on weeks you write on Sunday evening. A 10-minute reflection before bed might help ease into the week.',
    short: 'Your Monday entries are calmer on weeks you write on Sunday evening.',
  },
  {
    title: 'Reach out to an old friend',
    body: "You've mentioned missing touch with a few people this month. Even a short message tends to lift your mood in the days after.",
    short: "You've mentioned missing touch with a few people this month.",
  },
  {
    title: 'Name one work boundary this week',
    body: 'Boundary-setting keeps coming up as a wish, not yet an action. Pick one small, concrete one to try before Friday.',
    short: 'Boundary-setting keeps coming up as a wish, not yet an action.',
  },
]

export type StoryRange = 'daily' | 'weekly' | 'monthly' | 'yearly'

export const storyMonths: { month: string; mood: Mood; summary: string; quote: string }[] = [
  {
    month: 'August',
    mood: 'calm',
    summary: '18 entries · mostly calm, with a dip mid-month around a work deadline.',
    quote: 'Woke up before the alarm and just sat with my coffee...',
  },
  {
    month: 'July',
    mood: 'grateful',
    summary: '22 entries · a busy but proud month, capped by a short trip.',
    quote: "Three days away and I actually didn't check my phone once.",
  },
  {
    month: 'June',
    mood: 'hard',
    summary: '14 entries · a harder month, with a stretch of low energy.',
    quote: 'Not sure why today felt so heavy, but I got through it.',
  },
]

export const storyQuote = {
  text: 'Woke up before the alarm and just sat with my coffee for a while, no phone, no rush.',
  source: 'A slower morning · Aug 25',
}

export const weeklyReview = {
  range: 'Aug 18–24',
  sentAt: 'Sun, Aug 24 · 8:00 AM',
  headline: 'A steadier week, with a strong Sunday finish.',
  daysJournaled: '6/7',
  streak: 12,
  entryOfTheWeek: {
    title: 'A slower morning',
    quote: 'Woke up before the alarm and just sat with my coffee for a while, no phone, no rush...',
  },
}
