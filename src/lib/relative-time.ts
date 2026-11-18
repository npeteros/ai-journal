const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "Just now", "5 minutes ago", "3 hours ago", "yesterday", then a plain date after a week.
 * For past times only: a date after `now` (e.g. a server timestamp read with a client clock that
 * runs slow) reads as "Just now" rather than "in 3 minutes".
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.min(0, Math.round((date.getTime() - now.getTime()) / 1000))
  const abs = Math.abs(seconds)

  if (abs < MINUTE) return 'Just now'
  if (abs < HOUR) return relative.format(Math.round(seconds / MINUTE), 'minute')
  if (abs < DAY) return relative.format(Math.round(seconds / HOUR), 'hour')
  if (abs < 7 * DAY) return relative.format(Math.round(seconds / DAY), 'day')

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
