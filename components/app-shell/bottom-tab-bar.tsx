'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from 'cn'

import { SPRING } from '@/components/motion'
import { NAV_ITEMS, NEW_ENTRY_HREF, isActive, type NavItem } from './nav-items'

// Settings lives in the mobile header's account menu, so the bar keeps four sections
// split around the centre New entry button.
const TAB_ITEMS = NAV_ITEMS.filter((item) => item.href !== '/settings')
const LEFT_TABS = TAB_ITEMS.slice(0, 2)
const RIGHT_TABS = TAB_ITEMS.slice(2)

/** Mobile navigation (below lg): frosted bottom bar with a raised New entry button in the centre. */
export function BottomTabBar() {
  const pathname = usePathname()
  const onNewEntry = pathname === NEW_ENTRY_HREF

  const renderTab = ({ href, label, icon: Icon }: NavItem) => {
    // /journal/new belongs to the centre button, not the Journal tab.
    const active = !onNewEntry && isActive(pathname, href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] px-1 py-1.5 text-[11px] leading-none',
          active ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-400',
        )}
      >
        {active && (
          <motion.span
            layoutId="tabbar-active"
            transition={SPRING}
            className="absolute inset-x-1 inset-y-0 rounded-[14px] bg-amber-100"
          />
        )}
        <span className="relative flex">
          <Icon size={20} />
        </span>
        <span className="relative truncate">{label}</span>
      </Link>
    )
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-[var(--lv-card-border)] bg-[var(--lv-card-bg)] px-2 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[18px] backdrop-saturate-[1.3] lg:hidden"
    >
      {LEFT_TABS.map(renderTab)}

      <Link
        href={NEW_ENTRY_HREF}
        aria-label="New entry"
        aria-current={onNewEntry ? 'page' : undefined}
        className={cn(
          'relative flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5 text-[11px] leading-none',
          onNewEntry ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-400',
        )}
      >
        <span className="lv-cta -mt-8 flex size-[54px] items-center justify-center rounded-full ring-4 ring-surface">
          <Plus className="size-[22px]" strokeWidth={2.2} />
        </span>
        <span>New</span>
      </Link>

      {RIGHT_TABS.map(renderTab)}
    </nav>
  )
}
