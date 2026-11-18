'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { listSessions, revokeOtherSessions, revokeSession, useSession } from '@/src/lib/auth-client'
import { formatRelativeTime } from '@/src/lib/relative-time'
import { describeDevice, isMobileUserAgent } from '@/src/lib/user-agent'
import { RowIcon, SettingsSection } from './settings-ui'

export const SESSIONS_QUERY_KEY = ['auth', 'sessions'] as const

/** How often the "Active …" times are recalculated while the page is open. */
export const NOW_TICK_MS = 60_000

const rowClass = 'flex min-h-[60px] items-center justify-between gap-4 px-5 py-3.5'

/**
 * The signed-in user's sessions, from Better Auth (`listSessions`, which only ever returns the
 * caller's own). Signing one out revokes it server-side. "Last active" is when the session was
 * last refreshed, so it is approximate. Better Auth doesn't record a location, so the IP
 * address is shown instead.
 */
export function ActiveSessions() {
  const queryClient = useQueryClient()
  const { data: current } = useSession()
  const currentId = current?.session.id

  const sessions = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await listSessions()
      if (error || !data) throw new Error(error?.message || 'Could not load your sessions.')
      return data
    },
  })

  // The current time, refreshed every minute so "Active 2 minutes ago" keeps counting.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const refresh = () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY })

  // Only the latest action's error is shown: starting another action clears it.
  const [actionError, setActionError] = useState<string | null>(null)
  // Tokens being signed out, so only those rows' buttons are disabled.
  const [revoking, setRevoking] = useState<ReadonlySet<string>>(() => new Set())

  const signOutOne = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await revokeSession({ token })
      if (error) throw new Error(error.message || 'Could not sign out that session.')
    },
    onMutate: (token) => {
      setActionError(null)
      setRevoking((current) => new Set(current).add(token))
    },
    onError: (error) => setActionError(error.message),
    onSuccess: refresh,
    onSettled: (_data, _error, token) =>
      setRevoking((current) => {
        const next = new Set(current)
        next.delete(token)
        return next
      }),
  })
  const signOutOthers = useMutation({
    mutationFn: async () => {
      const { error } = await revokeOtherSessions()
      if (error) throw new Error(error.message || 'Could not sign out your other sessions.')
    },
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error.message),
    onSuccess: refresh,
  })

  // This device first, then the most recently active.
  const list = [...(sessions.data ?? [])].sort(
    (a, b) =>
      Number(b.id === currentId) - Number(a.id === currentId) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const hasOthers = list.some((s) => s.id !== currentId)
  const error = sessions.error?.message ?? actionError

  return (
    <SettingsSection label="Active sessions" i={2}>
      {sessions.isPending && (
        <div className={rowClass}>
          <span className="text-[13px] text-neutral-400">Loading your sessions…</span>
        </div>
      )}

      {list.map((s) => {
        const isCurrent = s.id === currentId
        const Icon = isMobileUserAgent(s.userAgent) ? Smartphone : Monitor
        const details = [s.ipAddress, `Active ${formatRelativeTime(new Date(s.updatedAt), now)}`]
          .filter(Boolean)
          .join(' · ')

        return (
          <div key={s.id} className={rowClass}>
            <span className="flex min-w-0 items-center gap-3">
              <RowIcon tone="sage">
                <Icon className="size-[15px]" strokeWidth={2} />
              </RowIcon>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 text-[14px] font-medium text-neutral-900">
                  {describeDevice(s.userAgent)}
                  {isCurrent && (
                    <span className="rounded-full bg-sage-100 px-2 py-[3px] text-[11px] leading-none font-semibold text-sage-700">
                      This device
                    </span>
                  )}
                </span>
                <span className="truncate text-[12px] text-neutral-400">{details}</span>
              </span>
            </span>
            {!isCurrent && (
              <Button
                type="button"
                variant="soft"
                size="md"
                disabled={revoking.has(s.token) || signOutOthers.isPending}
                onClick={() => signOutOne.mutate(s.token)}
              >
                {revoking.has(s.token) ? 'Signing out…' : 'Sign out'}
              </Button>
            )}
          </div>
        )
      })}

      {error && (
        <div className={rowClass}>
          <p role="alert" className="text-[13px] text-destructive">
            {error}
          </p>
        </div>
      )}

      {hasOthers && (
        <div className={rowClass}>
          <span className="text-[13px] text-neutral-600">
            Signed in somewhere you don&apos;t use?
          </span>
          <Button
            type="button"
            variant="danger"
            size="md"
            disabled={signOutOthers.isPending}
            onClick={() => signOutOthers.mutate()}
          >
            {signOutOthers.isPending ? 'Signing out…' : 'Sign out of all other sessions'}
          </Button>
        </div>
      )}
    </SettingsSection>
  )
}
