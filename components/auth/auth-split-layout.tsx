import type { ReactNode } from 'react'

import { Logo } from '@/components/brand/logo'
import { Rise } from '@/components/motion'

const currentYear = new Date().getFullYear()

/**
 * Sign in / Create account frame: dark ink brand panel with a slowly turning conic glow and
 * testimonial (desktop), centred 360px form column on the right. On mobile the panel collapses
 * to a logo row.
 */
export function AuthSplitLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="lv-paper flex min-h-dvh bg-bg">
      <aside className="relative isolate hidden w-[560px] shrink-0 flex-col justify-between overflow-hidden bg-ink p-14 lg:flex">
        <div
          aria-hidden
          className="lv-spin pointer-events-none absolute -bottom-[260px] -left-[220px] -z-10 size-[760px] rounded-full blur-[80px]"
          style={{
            background:
              'conic-gradient(from 30deg, oklch(55% 0.12 255 / .55), oklch(55% 0.12 305 / .35), oklch(66% 0.13 55 / .5), oklch(55% 0.12 150 / .35), oklch(55% 0.12 255 / .55))',
          }}
        />
        <Logo tone="on-ink" />

        <figure className="flex max-w-[400px] flex-col gap-4">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="oklch(70% 0.05 75)"
            strokeWidth="1.4"
            aria-hidden
          >
            <path d="M7 8h5v5a5 5 0 0 1-5 5v-3a2 2 0 0 0 2-2H7z" />
            <path d="M13 8h5v5a5 5 0 0 1-5 5v-3a2 2 0 0 0 2-2h-2z" />
          </svg>
          <blockquote className="font-serif text-[26px] leading-normal font-medium text-on-ink italic">
            &ldquo;Journaling with JADEN feels like having a quiet, honest conversation with
            yourself — one that actually remembers what you said last month.&rdquo;
          </blockquote>
          <figcaption className="text-[13px] font-semibold text-[oklch(70%_0.01_75)]">
            A daily user, 8 months in
          </figcaption>
        </figure>

        <p className="text-[12px] font-medium text-[oklch(55%_0.01_75)]">© {currentYear} JADEN</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="mb-10 self-start lg:hidden">
          <Logo />
        </div>
        <Rise className="flex w-full max-w-[360px] flex-col">
          <h1 className="font-serif text-[30px] leading-tight font-medium text-neutral-900">
            {title}
          </h1>
          <p className="mt-2 mb-7 text-[14px] leading-normal text-neutral-600">{subtitle}</p>
          {children}
        </Rise>
      </main>
    </div>
  )
}
