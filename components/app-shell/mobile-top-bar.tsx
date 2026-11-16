import { Logo } from '@/components/brand/logo'
import { AccountMenu } from './account-menu'
import type { ShellUser } from './user-avatar'

/** Mobile header (below lg): logo on the left, account avatar on the right. */
export function MobileTopBar({ user }: { user: ShellUser }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--lv-card-border)] bg-[var(--lv-card-bg)] px-5 pt-[calc(10px+env(safe-area-inset-top))] pb-2.5 backdrop-blur-[18px] backdrop-saturate-[1.3] lg:hidden">
      <Logo href="/journal" />
      <AccountMenu user={user} />
    </header>
  )
}
