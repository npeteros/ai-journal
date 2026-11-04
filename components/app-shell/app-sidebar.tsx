'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from 'cn'

import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { SPRING } from '@/components/motion'
import { NAV_ITEMS, NEW_ENTRY_HREF, isActive } from './nav-items'
import { StreakPill } from './streak-pill'

/** Desktop sidebar (lg+): logo, New entry, nav, streak pinned to the bottom. */
export function AppSidebar({ streakDays }: { streakDays: number }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-7 border-r border-neutral-200 bg-surface px-5 py-7 lg:flex">
      <Logo href="/journal" />

      <Button asChild variant="ink" size="cta" className="w-full">
        <Link href={NEW_ENTRY_HREF}>
          <Plus strokeWidth={2.2} />
          New entry
        </Link>
      </Button>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors',
                active
                  ? 'font-semibold text-neutral-900'
                  : 'font-medium text-neutral-400 hover:text-neutral-600',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={SPRING}
                  className="absolute inset-0 rounded-[10px] bg-neutral-100"
                />
              )}
              <span className="relative flex">
                <Icon size={18} />
              </span>
              <span className="relative">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      <StreakPill days={streakDays} />
    </aside>
  )
}
