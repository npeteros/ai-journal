import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell/app-shell'
import { placeholderUser } from '@/src/lib/placeholder/user'

// No session check yet: route protection is deliberately out of scope for the UI build.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell streakDays={placeholderUser.streakDays}>{children}</AppShell>
}
