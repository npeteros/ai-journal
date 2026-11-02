import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Orb } from '@/components/ui/ai'
import { cssVar, moodColor, type Mood } from '@/src/lib/design-tokens/colors'

type TodayBandProps = {
  prompt: string
  source: string
  week: { day: string; mood: Mood }[]
  writeHref: string
}

/** Dark hero band: today's AI prompt on the left, the week in mood dots on the right. */
export function TodayBand({ prompt, source, week, writeHref }: TodayBandProps) {
  return (
    <section
      aria-label="Today's prompt"
      className="relative isolate flex flex-col gap-6 overflow-hidden rounded-[22px] px-6 py-6 text-on-ink shadow-[0_24px_44px_-24px_oklch(22%_0.05_265/.8)] sm:flex-row sm:gap-7 sm:px-7"
      style={{ background: 'linear-gradient(150deg, oklch(27% 0.03 265), oklch(21% 0.02 40))' }}
    >
      <div
        aria-hidden
        className="lv-spin absolute -top-[140px] -right-[60px] -z-10 size-[420px] rounded-full blur-[50px]"
        style={{
          background:
            'conic-gradient(from 0deg, oklch(70% 0.12 255 / .55), oklch(72% 0.12 305 / .35), oklch(78% 0.12 60 / .45), oklch(70% 0.12 255 / .55))',
        }}
      />

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <Orb size={14} />
          <span
            className="lv-glint text-[11px] leading-none font-bold tracking-[0.08em] uppercase"
            style={{
              backgroundImage:
                'linear-gradient(90deg, oklch(85% 0.06 250), oklch(90% 0.08 60), oklch(85% 0.08 305), oklch(85% 0.06 250))',
            }}
          >
            Today&apos;s prompt
          </span>
        </div>
        <p className="max-w-[560px] font-serif text-[20px] leading-[1.3] font-medium italic sm:text-[24px]">
          &ldquo;{prompt}&rdquo;
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3.5">
          <Link
            href={writeHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-4 py-[9px] text-[13px] leading-none font-semibold transition-colors hover:bg-white/20"
          >
            Write about it <ArrowRight className="size-3" strokeWidth={2.4} />
          </Link>
          <span className="text-[12px] leading-none font-medium text-[oklch(80%_0.02_260)]">
            {source}
          </span>
        </div>
      </div>

      <div aria-hidden className="h-px bg-white/14 sm:h-auto sm:w-px" />

      <div className="flex flex-col justify-center gap-3.5">
        <span className="text-[11px] leading-none font-bold tracking-[0.08em] text-[oklch(80%_0.02_260)] uppercase">
          Your week
        </span>
        <ol
          className="flex justify-between gap-4 sm:justify-start"
          aria-label="Mood each day this week"
        >
          {week.map((d, i) => {
            const today = i === week.length - 1
            return (
              <li key={i} className="flex flex-col items-center gap-2">
                <span
                  className="relative size-3 rounded-full"
                  style={{ background: cssVar(moodColor[d.mood]) }}
                  title={d.mood}
                >
                  {today && (
                    <span
                      className="lv-ripple absolute -inset-1.5 rounded-full border-[1.5px]"
                      style={{ borderColor: cssVar(moodColor[d.mood]) }}
                    />
                  )}
                </span>
                <span
                  className={
                    today
                      ? 'text-[10px] leading-none font-extrabold text-[oklch(90%_0.08_60)]'
                      : 'text-[10px] leading-none font-semibold text-[oklch(75%_0.02_260)]'
                  }
                >
                  {d.day}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
