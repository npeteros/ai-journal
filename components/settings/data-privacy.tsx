'use client'

import { useState } from 'react'
import { FileText, Trash2 } from 'lucide-react'

import { Rise } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { OptionCards, RadioList } from '@/components/ui/controls'
import { exportInfo, retentionOptions } from '@/src/lib/placeholder/settings'

const FORMATS = [
  {
    value: 'md',
    label: 'Markdown',
    icon: <FileText className="size-5 text-sage-700" strokeWidth={1.75} />,
  },
  {
    value: 'json',
    label: 'JSON',
    icon: <FileText className="size-5 text-neutral-600" strokeWidth={1.75} />,
  },
] as const

/** Export your journal: format cards + export button. Placeholder: no file is generated yet. */
export function ExportCard() {
  const [format, setFormat] = useState<string>('md')
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase">
        Export your journal
      </h2>
      <Rise className="h-full">
        <div className="lv-card flex h-full flex-col gap-3.5 rounded-[14px] p-5">
          <p className="text-[13px] leading-normal text-neutral-600">
            Download a full copy of your entries. Nothing is sent anywhere.
          </p>
          <OptionCards
            aria-label="Export format"
            options={FORMATS}
            value={format}
            onValueChange={setFormat}
          />
          <div className="mt-auto flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-neutral-400">
              {exportInfo.entries} entries · {exportInfo.size}
            </span>
            <Button variant="ink-flat" className="h-[38px] rounded-[10px] px-[18px] text-[13px]">
              Export .{format}
            </Button>
          </div>
        </div>
      </Rise>
    </section>
  )
}

/** Right to forget: automatic deletion window. Placeholder: not persisted. */
export function RetentionCard() {
  const [value, setValue] = useState<string>(retentionOptions[0].value)
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[12px] leading-none font-bold tracking-[0.06em] text-neutral-400 uppercase">
        Right to forget
      </h2>
      <Rise i={1} className="h-full">
        <div className="lv-card h-full rounded-[14px]">
          <RadioList
            aria-label="Delete entries automatically"
            options={retentionOptions}
            value={value}
            onValueChange={setValue}
          />
        </div>
      </Rise>
      <p className="text-[12px] leading-normal text-neutral-400">
        Automatically and permanently delete entries after a set period. This can&apos;t be undone.
      </p>
    </section>
  )
}

/** Danger zone. Placeholder: the delete button does nothing until a confirm flow + soft-delete API exist. */
export function DangerZone() {
  return (
    <Rise i={3}>
      <div className="flex flex-col gap-4 rounded-[14px] border border-amber-500 px-5 py-[18px] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Trash2 className="size-[19px] shrink-0 text-amber-700" strokeWidth={2} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-amber-700">Delete all data now</span>
            <span className="text-[12px] leading-normal text-neutral-600">
              Permanently erased from your account and JADEN&apos;s servers.
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="danger"
          className="h-[38px] self-start rounded-[10px] px-[18px] text-[13px] sm:self-auto"
        >
          Delete
        </Button>
      </div>
    </Rise>
  )
}
