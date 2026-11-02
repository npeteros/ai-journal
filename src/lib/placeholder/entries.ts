/**
 * PLACEHOLDER DATA — mock journal entries for the UI build.
 * Shape follows EntryCreateOutput (src/server/api/routers/v1/entry/schema.ts) plus the
 * derived fields the UI shows (id, mood, AI summary). Replace with the entry tRPC router.
 */
import type { Mood } from '@/src/lib/design-tokens/colors'

export type PlaceholderEntry = {
  id: string
  title: string
  body: string
  /** ISO timestamp */
  writtenAt: string
  tags: string[]
  mood: Mood
  /** AI-generated, shown in the editor's right rail */
  summary?: string[]
  suggestedTags?: string[]
}

export const placeholderEntries: PlaceholderEntry[] = [
  {
    id: 'a-slower-morning',
    title: 'A slower morning',
    body: 'Woke up before the alarm and just sat with my coffee for a while. No phone, no rush — just the quiet and the sound of the kettle cooling down. I want to remember this feeling more often',
    writtenAt: '2026-08-25T08:14:00',
    tags: ['Gratitude'],
    mood: 'grateful',
    summary: [
      'Grateful for a quiet, unhurried morning',
      'Wants to protect this feeling more often',
    ],
    suggestedTags: ['Morning'],
  },
  {
    id: 'deadline-stress',
    title: 'Deadline stress',
    body: 'The client call moved up a day and I felt that familiar tightness in my chest again.',
    writtenAt: '2026-08-24T21:02:00',
    tags: ['Work'],
    mood: 'tired',
  },
  {
    id: 'sunday-call-with-mom',
    title: 'Sunday call with mom',
    body: "She told the story about the garden again and I didn't mind hearing it twice.",
    writtenAt: '2026-08-23T19:30:00',
    tags: ['Family'],
    mood: 'hard',
  },
  {
    id: 'small-wins',
    title: 'Small wins',
    body: "Finally fixed the thing that's been bugging me on the project for two weeks.",
    writtenAt: '2026-08-22T18:45:00',
    tags: ['Work'],
    mood: 'tired',
  },
  {
    id: 'grateful-tired',
    title: 'Grateful, tired',
    body: "Long day but the kids' laughter at dinner made all of it worth it.",
    writtenAt: '2026-08-21T22:10:00',
    tags: ['Family'],
    mood: 'hard',
  },
  {
    id: 'a-quiet-walk',
    title: 'A quiet walk',
    body: 'Took the long way home just to be outside a little longer before it got dark.',
    writtenAt: '2026-08-20T19:05:00',
    tags: ['Gratitude'],
    mood: 'grateful',
  },
]

export const entryFilters = ['All', 'Gratitude', 'Work', 'Family'] as const

/** "Today" for the placeholder world, so relative dates read naturally. */
/** Timezone-less on purpose: parses to the same wall-clock time on server and client. */
export const PLACEHOLDER_NOW_ISO = '2026-08-25T08:14:00'
export const PLACEHOLDER_NOW = new Date(PLACEHOLDER_NOW_ISO)

export function getPlaceholderEntry(id: string) {
  return placeholderEntries.find((e) => e.id === id)
}

export const todaysPrompt = {
  text: 'Three mornings this week felt slower. What made the space for them?',
  source: 'From your last 6 entries',
}

/** Mon-first week strip; the last item is today. */
export const weekMoods: { day: string; mood: Mood }[] = [
  { day: 'W', mood: 'tired' },
  { day: 'T', mood: 'calm' },
  { day: 'F', mood: 'calm' },
  { day: 'S', mood: 'grateful' },
  { day: 'S', mood: 'hard' },
  { day: 'M', mood: 'tired' },
  { day: 'T', mood: 'grateful' },
]

export const companionPrompt = 'What made this morning feel different from most?'

/**
 * Guided voice journaling: a scripted back-and-forth that stands in for a realtime AI voice model,
 * plus the entry JADEN drafts from it when the session ends.
 */
export type VoiceTurn = { role: 'jaden' | 'user'; text: string }

export const voiceSession: {
  turns: VoiceTurn[]
  draft: { title: string; body: string; tags: string[] }
} = {
  turns: [
    { role: 'jaden', text: "Morning, Maya. How's today starting out?" },
    {
      role: 'user',
      text: 'Slow, actually. I woke up before the alarm and just sat with my coffee.',
    },
    {
      role: 'jaden',
      text: 'That sounds peaceful. What made you stay with it instead of reaching for your phone?',
    },
    {
      role: 'user',
      text: 'I think I just needed to sit with that feeling for a minute before the day started.',
    },
    { role: 'jaden', text: "Is that something you'd like to make room for more often?" },
    { role: 'user', text: 'Yeah. I want to remember this feeling more often.' },
  ],
  draft: {
    title: 'A slower morning',
    body: 'Woke up before the alarm and just sat with my coffee — no phone, no rush. I needed a minute with that feeling before the day started, and I want to make room for it more often.',
    tags: ['Gratitude', 'Morning'],
  },
}
