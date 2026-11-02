/**
 * PLACEHOLDER DATA — mock settings / privacy values for the UI build.
 * Replace with user preferences, export metadata and the AI processing log from the API.
 */
export const reminderSettings = { enabled: true, time: '9:00 PM' }

export const exportInfo = { entries: 24, size: '128 KB' }

export const retentionOptions = [
  { value: 'never', label: 'Never delete automatically' },
  { value: '2y', label: 'Delete entries after 2 years' },
  { value: '1y', label: 'Delete entries after 1 year' },
] as const

export const aiUsageToday = { used: 7, limit: 20 }

export type ProcessingLogItem = {
  id: string
  kind: 'chat' | 'insight' | 'growth' | 'personality'
  event: string
  at: string
  detail: string
}

export const processingLog: ProcessingLogItem[] = [
  {
    id: 'p1',
    kind: 'chat',
    event: 'Chat with your journal',
    at: 'Today, 8:42 AM',
    detail: 'Sent: 3 entries (work-tagged) to answer "recurring themes about work"',
  },
  {
    id: 'p2',
    kind: 'insight',
    event: 'Deeper insights refresh',
    at: 'Today, 7:15 AM',
    detail: 'Sent: entry summaries from the last 6 months for trend analysis',
  },
  {
    id: 'p3',
    kind: 'growth',
    event: 'Growth suggestions',
    at: 'Yesterday, 9:03 PM',
    detail: 'Sent: 5 recent entries, mood tags for the last 14 days',
  },
  {
    id: 'p4',
    kind: 'personality',
    event: 'Personality refresh',
    at: 'Aug 20, 6:30 PM',
    detail: 'Sent: 62 entries, anonymized, for Big Five analysis',
  },
]

export const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
] as const
