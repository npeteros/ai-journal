import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'

import { Rise } from '@/components/motion'

/** Uppercase label + frosted card, the building block of every settings page. */
export function SettingsSection({
  label,
  i = 0,
  children,
  className,
}: {
  label: string
  i?: number
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <h2 className="text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase">
        {label}
      </h2>
      <Rise i={i}>
        <div className="lv-card divide-y divide-neutral-200 rounded-[14px]">{children}</div>
      </Rise>
    </section>
  )
}

/** Sage icon tile used on account rows. */
export function RowIcon({
  children,
  tone = 'plain',
}: {
  children: ReactNode
  tone?: 'plain' | 'sage' | 'cloud'
}) {
  if (tone === 'plain')
    return <span className="flex w-7 justify-center text-neutral-600">{children}</span>
  return (
    <span
      className={cn(
        'flex size-7 items-center justify-center rounded-lg',
        tone === 'sage' ? 'bg-sage-100 text-sage-700' : 'bg-cloud-100 text-cloud-700',
      )}
    >
      {children}
    </span>
  )
}

type SettingsRowProps = {
  icon?: ReactNode
  label: ReactNode
  /** Right side: a value, a control, or nothing (a chevron is shown when href is set). */
  value?: ReactNode
  href?: string
  /** Indent the label to line up with labels that have icons. */
  inset?: boolean
}

export function SettingsRow({ icon, label, value, href, inset }: SettingsRowProps) {
  const content = (
    <>
      <span className={cn('flex items-center gap-3', inset && 'pl-10')}>
        {icon}
        <span className="text-[14px] font-medium text-neutral-900">{label}</span>
      </span>
      <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-400">
        {value}
        {href && <ChevronRight className="size-4" strokeWidth={2} />}
      </span>
    </>
  )
  const cls = 'flex min-h-[60px] items-center justify-between gap-4 px-5 py-3.5'
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          cls,
          'transition-colors first:rounded-t-[14px] last:rounded-b-[14px] hover:bg-neutral-100/60',
        )}
      >
        {content}
      </Link>
    )
  }
  return <div className={cls}>{content}</div>
}

export function SettingsTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-serif text-[26px] leading-none font-semibold text-neutral-900 lg:text-[30px]">
      {children}
    </h1>
  )
}
