export const DEFAULT_AFTER_LOGIN = '/journal'

// Query flag set by the (app) layout when a session cookie exists but is no longer valid.
// The proxy lets /login through when it's present, which avoids a /login <-> /journal loop.
export const STALE_SESSION_PARAM = 'stale'

// Request header the proxy sets on protected routes so the (app) layout knows the current
// path (layouts don't receive it). Always overwritten by the proxy, so clients can't spoof it.
export const PATHNAME_HEADER = 'x-pathname'

const AUTH_PAGES = ['/login', '/register']

const hasControlChars = (value: string) =>
  [...value].some((ch) => {
    const code = ch.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })

/**
 * Returns `value` only if it's a same-origin relative path, otherwise the default
 * post-login page. Guards the `?redirect=` param against open redirects.
 */
export function getSafeRedirect(value: string | string[] | null | undefined): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return DEFAULT_AFTER_LOGIN
  // `//host` and `/\host` are protocol-relative to browsers; reject backslashes and control chars outright.
  if (value.startsWith('//') || value.includes('\\') || hasControlChars(value)) {
    return DEFAULT_AFTER_LOGIN
  }

  const base = 'http://local.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return DEFAULT_AFTER_LOGIN
  }
  if (url.origin !== base) return DEFAULT_AFTER_LOGIN
  if (AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return DEFAULT_AFTER_LOGIN
  }

  return `${url.pathname}${url.search}${url.hash}`
}
