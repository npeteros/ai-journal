/**
 * Small, dependency-free user-agent parsing for the active-sessions list. It only needs a
 * readable label ("Chrome on Windows") and a phone/desktop icon, not full UA detection.
 */

type Rule = readonly [label: string, pattern: RegExp]

// Order matters: Chromium-based browsers also claim "Chrome" and "Safari", and Chrome claims
// "Safari", so the more specific names come first.
const BROWSERS: readonly Rule[] = [
  ['Edge', /Edg(e|A|iOS)?\//],
  ['Opera', /OPR\/|Opera/],
  ['Samsung Internet', /SamsungBrowser\//],
  ['Firefox', /Firefox\/|FxiOS\//],
  ['Chrome', /Chrome\/|CriOS\//],
  ['Safari', /Version\/[\d.]+.*Safari\//],
]

// Android UAs also contain "Linux", and iOS UAs contain "like Mac OS X", so those come first.
const SYSTEMS: readonly Rule[] = [
  ['Android', /Android/],
  ['iOS', /iPhone|iPad|iPod/],
  ['Windows', /Windows/],
  ['macOS', /Mac OS X|Macintosh/],
  ['ChromeOS', /CrOS/],
  ['Linux', /Linux/],
]

const MOBILE = /Mobi|Android|iPhone|iPad|iPod/

function match(rules: readonly Rule[], userAgent: string): string | undefined {
  return rules.find(([, pattern]) => pattern.test(userAgent))?.[0]
}

/** A short label such as "Chrome on Windows", or "Unknown device" when nothing is recognised. */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device'
  const browser = match(BROWSERS, userAgent)
  const system = match(SYSTEMS, userAgent)
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? 'Unknown device'
}

/** Whether the user agent looks like a phone or tablet. */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && MOBILE.test(userAgent)
}
