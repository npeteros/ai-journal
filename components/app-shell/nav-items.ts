import type { ComponentType } from 'react'

import {
  ChatIcon,
  FrameworksIcon,
  InsightsIcon,
  JournalIcon,
  SettingsIcon,
} from '@/components/brand/icons'

export type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

/** Primary navigation — same order on the desktop sidebar and the mobile tab bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/journal', label: 'Journal', icon: JournalIcon },
  { href: '/frameworks', label: 'Frameworks', icon: FrameworksIcon },
  { href: '/insights', label: 'Insights', icon: InsightsIcon },
  { href: '/chat', label: 'Chat', icon: ChatIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
]

export const NEW_ENTRY_HREF = '/journal/new'

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
