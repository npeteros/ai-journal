import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}
const serverTimeZone = () => undefined

/** The browser's IANA time zone. Client-only: call it from event handlers or effects. */
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * `browserTimeZone()` as a hook. The zone isn't known during SSR, so this is `undefined` until
 * hydration; gate time-zone-dependent queries on it (`enabled: timeZone !== undefined`).
 */
export function useBrowserTimeZone(): string | undefined {
  return useSyncExternalStore(subscribeNever, browserTimeZone, serverTimeZone)
}
