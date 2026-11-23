/**
 * PLACEHOLDER DATA — mock journal entries for the UI build.
 * Only the landing preview still reads these; the journal
 * screens use the entry API (mood, summary and suggested tags come from `entry.analysis`).
 */

export type PlaceholderEntry = {
  id: string
  title: string
  body: string
  /** ISO timestamp */
  writtenAt: string
  tags: string[]
}

export const placeholderEntries: PlaceholderEntry[] = [
  {
    id: 'a-slower-morning',
    title: 'A slower morning',
    body: 'Woke up before the alarm and just sat with my coffee for a while. No phone, no rush — just the quiet and the sound of the kettle cooling down. I want to remember this feeling more often',
    writtenAt: '2026-08-25T08:14:00',
    tags: ['Gratitude'],
  },
  {
    id: 'deadline-stress',
    title: 'Deadline stress',
    body: 'The client call moved up a day and I felt that familiar tightness in my chest again.',
    writtenAt: '2026-08-24T21:02:00',
    tags: ['Work'],
  },
  {
    id: 'sunday-call-with-mom',
    title: 'Sunday call with mom',
    body: "She told the story about the garden again and I didn't mind hearing it twice.",
    writtenAt: '2026-08-23T19:30:00',
    tags: ['Family'],
  },
  {
    id: 'small-wins',
    title: 'Small wins',
    body: "Finally fixed the thing that's been bugging me on the project for two weeks.",
    writtenAt: '2026-08-22T18:45:00',
    tags: ['Work'],
  },
  {
    id: 'grateful-tired',
    title: 'Grateful, tired',
    body: "Long day but the kids' laughter at dinner made all of it worth it.",
    writtenAt: '2026-08-21T22:10:00',
    tags: ['Family'],
  },
  {
    id: 'a-quiet-walk',
    title: 'A quiet walk',
    body: 'Took the long way home just to be outside a little longer before it got dark.',
    writtenAt: '2026-08-20T19:05:00',
    tags: ['Gratitude'],
  },
]

/** "Today" for the placeholder world, so relative dates read naturally. */
/** Timezone-less on purpose: parses to the same wall-clock time on server and client. */
export const PLACEHOLDER_NOW_ISO = '2026-08-25T08:14:00'
export const PLACEHOLDER_NOW = new Date(PLACEHOLDER_NOW_ISO)

export function getPlaceholderEntry(id: string) {
  return placeholderEntries.find((e) => e.id === id)
}
