'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'

import { SegmentedControl } from '@/components/ui/controls'

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const
type ThemeChoice = (typeof OPTIONS)[number]['value']

const subscribe = () => () => {}

/** Light / Dark / System. Persisted by next-themes (localStorage); move to user prefs later. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // The stored theme is only known on the client; render "system" on the server to avoid a mismatch.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const value: ThemeChoice = mounted && (theme === 'light' || theme === 'dark') ? theme : 'system'

  return (
    <SegmentedControl
      id="theme"
      shape="pill"
      aria-label="Theme"
      options={OPTIONS}
      value={value}
      onValueChange={setTheme}
    />
  )
}
