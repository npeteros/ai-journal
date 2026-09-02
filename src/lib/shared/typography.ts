/**
 * JADEN type system
 * Newsreader (serif) for headlines and entry titles; Manrope (sans) for everything else.
 * Both are loaded via next/font/google in app/layout.tsx.
 */

export const fontFamily = {
  serif: "'Newsreader', Georgia, serif",
  sans: "'Manrope', 'Segoe UI', system-ui, sans-serif",
} as const;

/**
 * Named type styles. Each maps directly to CSS: fontFamily, fontSize (px), fontWeight,
 * lineHeight, and optional letterSpacing/textTransform for caption-style labels.
 */
export const type = {
  display: {
    fontFamily: fontFamily.serif,
    fontSize: 40,
    fontWeight: 500,
    lineHeight: 1.15,
  },
  headline: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: 500,
    lineHeight: 1.25,
  },
  title1: {
    fontFamily: fontFamily.serif,
    fontSize: 26,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  title2: {
    fontFamily: fontFamily.serif,
    fontSize: 22,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  title3: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  bodyLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    fontWeight: 400,
    lineHeight: 1.7,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.7,
  },
  bodySmall: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.55,
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1,
  },
  labelSmall: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
} as const;

export type TypeStyleName = keyof typeof type;

export const typography = { fontFamily, type } as const;

export default typography;
