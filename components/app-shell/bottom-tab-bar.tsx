'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from 'cn'

import { SPRING } from '@/components/motion'
import { NAV_ITEMS, NEW_ENTRY_HREF, isActive } from './nav-items'

/** Mobile navigation (below lg): frosted bottom tab bar with all five sections + New entry FAB. */
export function BottomTabBar() {
  const pathname = usePathname()
  // The New entry FAB only appears on Journal Home
  const showFab = pathname === '/journal'

  return (
    <>
      {showFab && (
        <div className="fixed right-5 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 size-[58px] lg:hidden">
          <span aria-hidden className="lv-ripple absolute inset-0 rounded-[20px] bg-amber-500" />
          <Link
            href={NEW_ENTRY_HREF}
            aria-label="New entry"
            className="lv-cta relative flex size-[58px] items-center justify-center rounded-[20px]"
          >
            <Plus className="size-[22px]" strokeWidth={2.2} />
          </Link>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex items-start justify-around border-t border-[var(--lv-card-border)] bg-[var(--lv-card-bg)] px-2 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[18px] backdrop-saturate-[1.3] lg:hidden"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
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
        })}
      </nav>
    </>
  )
}
