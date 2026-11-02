'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from 'cn'

import { SPRING } from '@/components/motion'

const TABS = [
  { href: '/insights', label: 'Overview' },
  { href: '/insights/deeper', label: 'Deeper insights' },
  { href: '/insights/personality', label: 'Personality' },
  { href: '/insights/growth', label: 'Growth' },
  { href: '/insights/story', label: 'Story' },
] as const

/** "Insights" title + underline sub-tabs shared by every insights page. */
export function InsightsHeader() {
  const pathname = usePathname()

  return (
    <header className="flex flex-col gap-5">
      <h1 className="font-serif text-[28px] leading-none font-semibold text-neutral-900 lg:text-[34px]">
        Insights
      </h1>
      <nav
        aria-label="Insights sections"
        className="-mx-5 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-neutral-200 px-5 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => {
          const active = pathname === t.href
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative shrink-0 pb-3 text-[14px] whitespace-nowrap transition-colors',
                active
                  ? 'font-semibold text-neutral-900'
                  : 'font-medium text-neutral-400 hover:text-neutral-600',
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="insights-tab"
                  transition={SPRING}
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-neutral-900"
                />
              )}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
