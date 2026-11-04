import type { ReactNode } from 'react'
import { cn } from 'cn'

/** Per-section atmosphere tint (see app/life.css). */
export type PageTone = 'paper' | 'mist' | 'meadow' | 'dusk'

const toneClass: Record<PageTone, string> = {
  paper: '',
  mist: 'lv-mist',
  meadow: 'lv-meadow',
  dusk: 'lv-dusk',
}

/**
 * A page inside the app shell: living-paper background + standard content padding
 * (48/56px desktop, 20px mobile).
 */
export function Page({
  tone = 'paper',
  className,
  children,
}: {
  tone?: PageTone
  className?: string
  children: ReactNode
}) {
  return (
    <main
      className={cn(
        'lv-paper lv-paper-fixed flex min-h-full flex-1 flex-col gap-6 px-5 pt-8 pb-10 sm:px-8 lg:px-14 lg:pt-12 lg:pb-14',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </main>
  )
}

/** Page title block: optional overline, serif title, optional subtitle, optional right-side actions. */
export function PageHeader({
  overline,
  title,
  subtitle,
  actions,
  className,
}: {
  overline?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="flex flex-col gap-2.5">
        {overline && (
          <p className="text-[12px] leading-none font-bold tracking-[0.09em] text-amber-700 uppercase">
            {overline}
          </p>
        )}
        <h1 className="font-serif text-[28px] leading-[1.05] font-semibold text-neutral-900 lg:text-[34px]">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-neutral-600">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  )
}
