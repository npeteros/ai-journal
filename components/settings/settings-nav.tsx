'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from 'cn'

import { SPRING } from '@/components/motion'

const ITEMS = [
  { href: '/settings', label: 'General' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/reminders', label: 'Reminders' },
  { href: '/settings/data-privacy', label: 'Data & privacy' },
] as const

/** Settings sub-navigation: a 220px column on desktop, a scrolling pill row on mobile. */
export function SettingsNav() {
  const pathname = usePathname()
  // Language lives under General
  const current = pathname === '/settings/language' ? '/settings' : pathname

  return (
    <nav
      aria-label="Settings"
      className="-mx-5 flex shrink-0 gap-1 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:w-[220px] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-r lg:border-neutral-200 lg:px-5 lg:py-12"
    >
      <p className="hidden px-3 pb-2.5 text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase lg:block">
        Settings
      </p>
      {ITEMS.map((item) => {
        const active = current === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative shrink-0 rounded-[10px] px-3 py-2.5 text-[14px] leading-none whitespace-nowrap transition-colors',
              active
                ? 'font-semibold text-neutral-900'
                : 'font-medium text-neutral-600 hover:text-neutral-900',
            )}
          >
            {active && (
              <motion.span
                layoutId="settings-active"
                transition={SPRING}
                className="absolute inset-0 rounded-[10px] bg-neutral-100"
              />
            )}
            <span className="relative">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
