/**
 * Jaden — JADEN's teddy-bear companion. Configuration and source of truth for the rig:
 * moods, gestures, sizes and per-screen placements.
 */

/** SVG viewBox. The card/ledge edge sits at y = EDGE_Y; Jaden peeks over it. */
export const VIEWBOX = { width: 160, height: 152 } as const
export const EDGE_Y = 140

/** Size rules: one hero per screen, inline elsewhere. */
export const SIZES = {
  hero: 176,
  inline: 120,
  avatar: 32,
} as const
export type JadenSize = keyof typeof SIZES | number

export function resolveSize(size: JadenSize): number {
  return typeof size === 'number' ? size : SIZES[size]
}

/** Height of the rig (px) for a given width. */
export function heightFor(width: number): number {
  return Math.round(((width * VIEWBOX.height) / VIEWBOX.width) * 10) / 10
}

/** How far the rig extends below the ledge line (px) at a given width. */
export function belowEdge(width: number): number {
  return Math.round((((VIEWBOX.height - EDGE_Y) * width) / VIEWBOX.width) * 10) / 10
}

export const MOODS = {
  neutral: { label: 'Neutral', use: 'Default. Calm, present, listening.' },
  happy: { label: 'Happy', use: 'A good entry, a kind moment, a pet.' },
  thinking: { label: 'Thinking', use: 'While JADEN reads or writes.' },
  sleepy: { label: 'Sleepy', use: 'Late evening, wind-down prompts.' },
  curious: { label: 'Curious', use: 'A new pattern or question to explore.' },
  proud: { label: 'Proud', use: 'Streak milestones, a finished framework.' },
  concerned: { label: 'Concerned', use: 'Hard entries. Soft, never alarmed.' },
} as const
export type JadenMood = keyof typeof MOODS

/** Jaden's expression for an entry's mood score (0–100, higher = better). */
export function moodForScore(score: number): JadenMood {
  if (score >= 70) return 'happy'
  if (score >= 40) return 'neutral'
  return 'concerned'
}

export const GESTURES = {
  wave: {
    label: 'Wave',
    mood: 'neutral',
    duration: '3.4s',
    use: 'Greeting on first open. Once per session.',
  },
  sip: {
    label: 'Sip',
    mood: 'neutral',
    duration: '4.4s',
    use: "Morning idle. Coffee is Jaden's thing.",
  },
  nod: { label: 'Nod', mood: 'neutral', duration: '2.6s', use: 'Acknowledges what you wrote.' },
  yawn: {
    label: 'Yawn',
    mood: 'neutral',
    duration: '4.6s',
    use: 'Evening idle, or after long inactivity.',
  },
  think: {
    label: 'Think',
    mood: 'thinking',
    duration: '4s',
    use: 'While AI is working. Pairs with dots.',
  },
} as const satisfies Record<
  string,
  { label: string; mood: JadenMood; duration: string; use: string }
>
export type JadenGesture = keyof typeof GESTURES

/**
 * none    — static
 * arrive  — peeks up from behind the edge (quiet screens)
 * intro   — arrive + one wave (first impressions, milestones)
 * live    — intro + 20s acting loop (one hero per app: Journal Home)
 */
export const ENTRANCES = ['none', 'arrive', 'intro', 'live'] as const
export type JadenEntrance = (typeof ENTRANCES)[number]

/** How long a pet (tap) reaction lasts, ms. Matches the mc-pet-* keyframes. */
export const PET_DURATION_MS = 1600

export type JadenPlacement = {
  mood: JadenMood
  size: number
  entrance: JadenEntrance
  gesture?: JadenGesture
  mug?: boolean
  say?: string
  saySide?: 'left' | 'right'
}

/** Per-screen placements. Speech bubbles: 4 words max. */
export const PLACEMENTS = {
  onboarding: { mood: 'happy', size: 124, entrance: 'intro', say: "hi, I'm Jaden!" },
  journalHome: { mood: 'neutral', size: 176, entrance: 'live', say: 'hi {name}!' },
  editor: { mood: 'curious', size: 96, entrance: 'arrive', gesture: 'nod' },
  voice: { mood: 'curious', size: 124, entrance: 'arrive', gesture: 'nod', mug: false },
  companion: { mood: 'curious', size: 116, entrance: 'arrive' },
  chat: { mood: 'thinking', size: 140, entrance: 'arrive', gesture: 'think', mug: false },
  insights: { mood: 'curious', size: 150, entrance: 'arrive', say: 'calmer this week!' },
  growth: { mood: 'happy', size: 104, entrance: 'arrive' },
  weeklyReview: { mood: 'proud', size: 112, entrance: 'intro', say: '12 days!' },
} as const satisfies Record<string, JadenPlacement>
export type JadenPlacementKey = keyof typeof PLACEMENTS
