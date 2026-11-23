import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Orb } from '@/components/ui/ai'
import { APP_TIME_ZONE } from '@/src/lib/app-time-zone'
import { starterPromptAt } from '@/src/lib/daily-prompt-starters'
import { TodayPrompt } from './today-prompt'
import { WeekMoodStrip } from './week-mood-strip'

type TodayBandProps = {
  writeHref: string
}

/** Dark hero band: today's AI prompt on the left, the week in mood dots on the right. */
export function TodayBand({ writeHref }: TodayBandProps) {
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
        <TodayPrompt fallback={starterPromptAt(APP_TIME_ZONE)}>
          <Link
            href={writeHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-4 py-[9px] text-[13px] leading-none font-semibold transition-colors hover:bg-white/20"
          >
            Write about it <ArrowRight className="size-3" strokeWidth={2.4} />
          </Link>
        </TodayPrompt>
      </div>

      <div aria-hidden className="h-px bg-white/14 sm:h-auto sm:w-px" />

      <div className="flex flex-col justify-center gap-3.5">
        <span className="text-[11px] leading-none font-bold tracking-[0.08em] text-[oklch(80%_0.02_260)] uppercase">
          Your week
        </span>
        <WeekMoodStrip />
      </div>
    </section>
  )
}
