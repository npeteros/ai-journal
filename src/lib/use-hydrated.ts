import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}

/**
 * `false` during SSR and the hydration render, `true` after. Use it to render data from a
 * streamed (prefetched, not awaited) query: the query can still be pending when the server
 * renders but already resolved when the browser hydrates, and React won't patch the mismatched
 * attributes, so the server's "loading" markup would stick.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
}
