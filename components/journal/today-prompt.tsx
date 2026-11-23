'use client'

import { skipToken, useQuery } from '@tanstack/react-query'

import { useBrowserTimeZone } from '@/src/lib/browser-time-zone'
import { STARTER_PROMPT_SOURCE } from '@/src/lib/daily-prompt-starters'
import { useTRPC } from '@/src/server/trpc/client'

type TodayPromptProps = {
  /** Starter prompt rendered on the server, shown until the user's prompt loads. */
  fallback: string
  children?: React.ReactNode
}

/**
 * Today's journaling prompt. Shows `fallback` until the user's prompt loads (the browser's time
 * zone isn't known during SSR).
 */
export function TodayPrompt({ fallback, children }: TodayPromptProps) {
  const trpc = useTRPC()
  const timeZone = useBrowserTimeZone()
  const { data } = useQuery(
    trpc.v1.insights.todayPrompt.queryOptions(timeZone === undefined ? skipToken : { timeZone }),
  )
  const prompt = data ?? {
    text: fallback,
    source: STARTER_PROMPT_SOURCE,
  }

  return (
    <>
      <p
        className="max-w-[560px] font-serif text-[20px] leading-[1.3] font-medium italic sm:text-[24px]"
        aria-busy={data === undefined}
      >
        &ldquo;{prompt.text}&rdquo;
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-3.5">
        {children}
        <span className="text-[12px] leading-none font-medium text-[oklch(80%_0.02_260)]">
          {prompt.source}
        </span>
      </div>
    </>
  )
}
