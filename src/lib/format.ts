/**
 * Date formatting for entries. `now` defaults to the placeholder "today" so mock data reads
 * naturally ("Today, Aug 25"); pass `new Date()` once entries are real.
 */
import { PLACEHOLDER_NOW } from '@/src/lib/placeholder/entries'

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const weekdayMonthDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** "Today, Aug 25" or "Mon, Aug 24" */
export function formatEntryDate(iso: string, now: Date = PLACEHOLDER_NOW) {
  const d = new Date(iso)
  return sameDay(d, now) ? `Today, ${monthDay.format(d)}` : weekdayMonthDay.format(d)
}

/** "Today, Aug 25 · 8:14 AM" */
export function formatEntryDateTime(iso: string, now: Date = PLACEHOLDER_NOW) {
  return `${formatEntryDate(iso, now)} · ${time.format(new Date(iso))}`
}

/** "Tuesday, Aug 25 · 8:14 am" (journal home overline) */
export function formatTodayOverline(now: Date = PLACEHOLDER_NOW) {
  return `${longDate.format(now)} · ${time.format(now).toLowerCase()}`
}

/** "Good morning" / "Good afternoon" / "Good evening" */
export function greetingFor(now: Date = PLACEHOLDER_NOW) {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
