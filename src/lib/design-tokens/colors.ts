/**
 * JADEN colour tokens.
 *
 * Typed mirror of the CSS custom properties in `app/globals.css` (`:root` = light, `.dark` = dark).
 * The CSS variables are what the browser uses at runtime; keep both files in sync when a value changes.
 *
 * Prefer Tailwind utilities (`bg-surface`, `text-neutral-600`, `bg-sage-100`, …) in markup.
 * Use `cssVar()` for inline styles and SVG attributes (charts, the mascot) so the value still
 * follows the active theme.
 */

export const colorTokens = {
  // Paper + ink
  bg: { light: 'oklch(97.4% 0.014 80)', dark: 'oklch(17% 0.012 70)' },
  surface: { light: 'oklch(99.4% 0.006 85)', dark: 'oklch(21% 0.012 72)' },
  'neutral-100': { light: 'oklch(95% 0.012 78)', dark: 'oklch(26% 0.012 75)' },
  'neutral-200': { light: 'oklch(90.5% 0.013 76)', dark: 'oklch(32% 0.012 75)' },
  'neutral-300': { light: 'oklch(84% 0.008 75)', dark: 'oklch(42% 0.01 75)' },
  'neutral-400': { light: 'oklch(70% 0.01 75)', dark: 'oklch(62% 0.01 75)' },
  'neutral-600': { light: 'oklch(50% 0.012 75)', dark: 'oklch(78% 0.012 75)' },
  'neutral-900': { light: 'oklch(22% 0.012 75)', dark: 'oklch(95% 0.012 78)' },

  // Sage: calm, growth, AI-suggested tags, selected options
  'sage-100': { light: 'oklch(94.5% 0.045 150)', dark: 'oklch(29% 0.045 150)' },
  'sage-200': { light: 'oklch(87% 0.08 150)', dark: 'oklch(38% 0.07 150)' },
  'sage-500': { light: 'oklch(62% 0.11 152)', dark: 'oklch(68% 0.11 152)' },
  'sage-700': { light: 'oklch(40% 0.08 152)', dark: 'oklch(85% 0.08 152)' },

  // Cloud: AI presence, links, trends
  'cloud-100': { light: 'oklch(94.5% 0.04 252)', dark: 'oklch(29% 0.045 252)' },
  'cloud-200': { light: 'oklch(87% 0.075 252)', dark: 'oklch(38% 0.07 252)' },
  'cloud-500': { light: 'oklch(58% 0.12 256)', dark: 'oklch(68% 0.12 256)' },
  'cloud-700': { light: 'oklch(38% 0.09 258)', dark: 'oklch(84% 0.08 258)' },

  // Amber: streaks, momentum, greeting accent, danger zone
  'amber-100': { light: 'oklch(94.5% 0.05 68)', dark: 'oklch(30% 0.05 60)' },
  'amber-200': { light: 'oklch(87% 0.09 62)', dark: 'oklch(40% 0.08 58)' },
  'amber-500': { light: 'oklch(68% 0.15 52)', dark: 'oklch(72% 0.15 52)' },
  'amber-700': { light: 'oklch(46% 0.12 45)', dark: 'oklch(85% 0.1 55)' },

  'rose-500': { light: 'oklch(64% 0.12 20)', dark: 'oklch(70% 0.12 20)' },
  'lilac-500': { light: 'oklch(66% 0.11 305)', dark: 'oklch(72% 0.11 305)' },

  // Always-dark surfaces (auth panel, today band)
  ink: { light: 'oklch(22% 0.012 75)', dark: 'oklch(12% 0.012 70)' },
  'on-ink': { light: 'oklch(97.4% 0.014 80)', dark: 'oklch(95% 0.012 78)' },
} as const satisfies Record<string, { light: string; dark: string }>

export type ColorToken = keyof typeof colorTokens

/** `var(--token)` reference that follows the active theme. */
export function cssVar(token: ColorToken): string {
  return `var(--${token})`
}

/** Moods used across entries, charts and the week strip. */
export const moods = ['calm', 'grateful', 'tired', 'anxious', 'hard'] as const
export type Mood = (typeof moods)[number]

/** Mood → accent colour (entry spines, mood dots, timeline nodes). */
export const moodColor: Record<Mood, ColorToken> = {
  calm: 'sage-500',
  grateful: 'amber-500',
  tired: 'cloud-500',
  anxious: 'neutral-600',
  hard: 'rose-500',
}

/** `lv-mood-*` spine class for entry cards (see app/life.css). */
export const moodSpineClass: Record<Mood, string> = {
  calm: 'lv-mood-sage',
  grateful: 'lv-mood-amber',
  tired: 'lv-mood-cloud',
  anxious: 'lv-mood-neutral',
  hard: 'lv-mood-rose',
}

export const moodLabel: Record<Mood, string> = {
  calm: 'Calm',
  grateful: 'Grateful',
  tired: 'Tired',
  anxious: 'Anxious',
  hard: 'Hard day',
}
