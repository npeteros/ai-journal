/**
 * JADEN typography tokens.
 *
 * Fonts: Newsreader (serif: titles, headings, quotes) and Manrope (sans: UI and body).
 * Loaded once here and applied in `app/layout.tsx`; `app/globals.css` maps them to the
 * `font-serif` / `font-sans` Tailwind utilities.
 *
 * `type` is the type scale as Tailwind class strings. Compose with `cn()` and add
 * colour separately (e.g. `cn(type.pageTitle, 'text-neutral-900')`).
 */
import { Manrope, Newsreader } from 'next/font/google'

export const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '800'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

/** Class names that expose the font CSS variables; apply on <html>. */
export const fontVariables = `${newsreader.variable} ${manrope.variable}`

export const type = {
  /** Onboarding hero, 44–52px */
  hero: 'font-serif text-[40px] font-medium leading-[1.15] tracking-[-0.01em] lg:text-[52px]',
  /** Journal greeting, 40px */
  greeting: 'font-serif text-[30px] font-medium leading-[1.05] lg:text-[40px]',
  /** Page titles, 30–34px */
  pageTitle: 'font-serif text-[28px] font-semibold leading-none lg:text-[34px]',
  /** Auth form titles */
  authTitle: 'font-serif text-[30px] font-medium leading-tight',
  /** Editor entry title */
  editorTitle: 'font-serif text-[26px] font-medium leading-tight lg:text-[30px]',
  /** Entry title on cards */
  cardTitle: 'font-serif text-[19px] font-semibold leading-[1.3]',
  /** Serif pull quotes / prompts */
  quote: 'font-serif text-[20px] italic leading-[1.45] lg:text-[24px]',
  /** Big stat numbers */
  stat: 'font-serif text-[32px] font-extrabold leading-none',
  /** Card headings */
  cardHeading: 'font-sans text-[15px] font-semibold',
  /** Default body copy */
  body: 'font-sans text-[14px] leading-[1.6]',
  /** Smaller body / excerpts */
  bodySm: 'font-sans text-[13px] leading-[1.55]',
  /** Editor body */
  editorBody: 'font-sans text-[17px] leading-[1.8]',
  /** Uppercase overlines / section labels */
  overline: 'font-sans text-[11px] font-bold uppercase tracking-[0.08em]',
  /** Small captions */
  caption: 'font-sans text-[12px] font-medium',
} as const

export type TypeToken = keyof typeof type
