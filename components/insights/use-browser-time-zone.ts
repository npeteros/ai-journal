'use client'

import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const serverTimeZone = () => undefined

/**
 * The browser's IANA time zone. It isn't known during SSR, so this is `undefined` until hydration;
 * gate time-zone-dependent queries on it (`enabled: timeZone !== undefined`).
 */
export function useBrowserTimeZone(): string | undefined {
  return useSyncExternalStore(subscribeNever, browserTimeZone, serverTimeZone)
}
