import Link from 'next/link'
import { cn } from 'cn'

import { JournalIcon } from './icons'

type LogoProps = {
  /** "light" = ink tile on paper; "on-ink" = paper tile on a dark panel */
  tone?: 'light' | 'on-ink'
  href?: string
  className?: string
}

export function Logo({ tone = 'light', href = '/', className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5 px-1', className)}
      aria-label="JADEN home"
    >
      <span
        className={cn(
          'flex size-[30px] shrink-0 items-center justify-center rounded-[9px]',
          tone === 'light' ? 'bg-neutral-900 text-surface' : 'bg-on-ink text-ink',
        )}
      >
        <JournalIcon size={15} />
      </span>
      <span
        className={cn(
          'font-serif text-[19px] leading-none font-semibold',
          tone === 'light' ? 'text-neutral-900' : 'text-on-ink',
        )}
      >
        JADEN
      </span>
    </Link>
  )
}
