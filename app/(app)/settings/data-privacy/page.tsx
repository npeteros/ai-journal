import type { Metadata } from 'next'
import { LineChart, type LucideIcon, MessageSquare, Sparkles, UserRound } from 'lucide-react'

import { GrowBar, Rise } from '@/components/motion'
import { DangerZone, ExportCard, RetentionCard } from '@/components/settings/data-privacy'
import { SettingsTitle } from '@/components/settings/settings-ui'
import { aiUsageToday, processingLog, type ProcessingLogItem } from '@/src/lib/placeholder/settings'

export const metadata: Metadata = { title: 'Data & privacy' }

const LOG_ICON: Record<ProcessingLogItem['kind'], LucideIcon> = {
  chat: MessageSquare,
  insight: LineChart,
  growth: Sparkles,
  personality: UserRound,
}

export default function DataPrivacyPage() {
  return (
    <>
      <SettingsTitle>Data &amp; privacy</SettingsTitle>

      <div className="grid gap-5 md:grid-cols-2">
        <ExportCard />
        <RetentionCard />
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase">
            Processing log
          </h2>
          <span className="text-[12px] font-medium text-neutral-400">
            {aiUsageToday.used} of {aiUsageToday.limit} requests used today
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-neutral-100">
          <GrowBar
            value={(aiUsageToday.used / aiUsageToday.limit) * 100}
            className="h-full rounded-full bg-cloud-500"
          />
        </div>
        <Rise i={2}>
          <ul className="lv-card divide-y divide-neutral-200 rounded-[14px]">
            {processingLog.map((item) => {
              const Icon = LOG_ICON[item.kind]
              return (
                <li key={item.id} className="flex flex-col gap-1 px-[18px] py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2.5 text-[13px] font-medium text-neutral-900">
                      <Icon className="size-[15px] text-cloud-700" strokeWidth={2.2} />
                      {item.event}
                    </span>
                    <span className="shrink-0 text-[12px] font-medium text-neutral-400">
                      {item.at}
                    </span>
                  </div>
                  <p className="pl-[25px] text-[12px] leading-normal text-neutral-600">
                    {item.detail}
                  </p>
                </li>
              )
            })}
          </ul>
        </Rise>
        <p className="text-[12px] text-neutral-400">
          Exactly what was sent to cloud AI, and when. Nothing here is used to train models.
        </p>
      </section>

      <DangerZone />
    </>
  )
}
