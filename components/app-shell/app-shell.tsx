import type { ReactNode } from 'react'

import { AppSidebar } from './app-sidebar'
import { BottomTabBar } from './bottom-tab-bar'
import { MobileTopBar } from './mobile-top-bar'
import type { ShellUser } from './user-avatar'

/** Logged-in frame: sidebar on desktop; header + bottom tab bar on mobile. */
export function AppShell({
  streakDays,
  user,
  children,
}: {
  streakDays: number
  user: ShellUser
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <AppSidebar streakDays={streakDays} user={user} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))] lg:pb-0">
        <MobileTopBar user={user} />
        {children}
      </div>
      <BottomTabBar />
    </div>
  )
}
