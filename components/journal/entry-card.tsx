import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from 'cn'

import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import type { Mood } from '@/src/lib/design-tokens/colors'
import { formatEntryDate } from '@/src/lib/format'

type EntryCardProps = {
  entry: {
    id: string
    title: string
    body: string
    /** ISO timestamp */
    writtenAt: string
    tags: string[]
    /** Not part of the entry API yet; the spine is hidden when omitted. */
    mood?: Mood
  }
  /** Reference date for "Today"; defaults to the placeholder date, so real entries pass `new Date()`. */
  now?: Date
  /** Link to the editor; omit for decorative previews (onboarding). */
  href?: string
  className?: string
  /** Show the coloured mood spine. Off when something perches on the card (the spine clips overflow). */
  spine?: boolean
  /** Rendered inside the card before its content (e.g. a perched Jaden). */
  children?: ReactNode
}

/** Entry card: date overline, serif title, 2–3 line excerpt, tags, coloured mood spine. */
export function EntryCard({ entry, href, now, className, spine = true, children }: EntryCardProps) {
  const body = (
    <Card
      mood={spine ? entry.mood : undefined}
      hover={!!href}
      className={cn('flex h-full flex-col gap-2 p-5', className)}
    >
      {children}
      <p
        suppressHydrationWarning
        className="text-[11px] leading-none font-semibold tracking-[0.05em] text-neutral-400 uppercase"
      >
        {formatEntryDate(entry.writtenAt, now)}
      </p>
      <h3 className="font-serif text-[18px] leading-[1.3] font-semibold text-neutral-900 lg:text-[19px]">
        {entry.title}
      </h3>
      <p className="line-clamp-3 text-[13px] leading-[1.55] text-neutral-600">{entry.body}</p>
      {entry.tags.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {entry.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}
    </Card>
  )

  if (!href) return body
  return (
    <Link
      href={href}
      className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {body}
    </Link>
  )
}
