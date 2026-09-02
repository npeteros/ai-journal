/**
 * JADEN color palette
 * Calm & minimal: warm neutral base, sage = secondary accent, dusty blue = primary/AI accent,
 * amber = streaks/momentum. All accents share chroma/lightness per hue; only hue varies.
 */

export const neutral = {
  bg: "oklch(98% 0.008 75)",
  surface: "oklch(99% 0.004 75)",
  100: "oklch(95% 0.008 75)",
  200: "oklch(90% 0.007 75)",
  300: "oklch(84% 0.008 75)",
  400: "oklch(70% 0.01 75)",
  600: "oklch(50% 0.012 75)",
  900: "oklch(22% 0.012 75)",
} as const;

export const sage = {
  100: "oklch(94% 0.03 150)",
  200: "oklch(87% 0.05 150)",
  500: "oklch(62% 0.07 150)",
  700: "oklch(38% 0.06 150)",
} as const;

export const cloud = {
  100: "oklch(94% 0.03 250)",
  200: "oklch(87% 0.05 250)",
  500: "oklch(62% 0.07 250)",
  700: "oklch(38% 0.06 250)",
} as const;

export const amber = {
  100: "oklch(94% 0.035 55)",
  200: "oklch(87% 0.06 55)",
  500: "oklch(62% 0.07 55)",
  700: "oklch(42% 0.08 55)",
} as const;

/** Semantic aliases — prefer these in components over reaching into a raw scale. */
export const color = {
  background: neutral.bg,
  surface: neutral.surface,
  border: neutral[200],
  textPrimary: neutral[900],
  textSecondary: neutral[600],
  textMuted: neutral[400],

  /** Streaks, momentum, and other celebratory accents. */
  streak: {
    bg: amber[100],
    border: amber[200],
    fg: amber[700],
    accent: amber[500],
  },
} as const;

export const shadow = {
  sm: "0 1px 2px oklch(22% 0.012 75 / 0.06), 0 1px 1px oklch(22% 0.012 75 / 0.04)",
  md: "0 10px 28px oklch(22% 0.012 75 / 0.10)",
} as const;

export const palette = { neutral, sage, cloud, amber, color, shadow } as const;

export default palette;
