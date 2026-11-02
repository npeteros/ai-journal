'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'

import { Switch } from '@/components/ui/controls'
import { RowIcon, SettingsRow } from './settings-ui'

const TIMES = ['7:00 AM', '8:00 AM', '12:00 PM', '6:00 PM', '9:00 PM', '10:00 PM']

/** Daily reminder toggle + time. Placeholder: wire to user preferences. */
export function ReminderRows({ initial }: { initial: { enabled: boolean; time: string } }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [time, setTime] = useState(initial.time)

  return (
    <>
      <SettingsRow
        icon={
          <RowIcon>
            <Bell className="size-[18px]" strokeWidth={2} />
          </RowIcon>
        }
        label="Daily reminder"
        value={
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Daily reminder" />
        }
      />
      <SettingsRow
        inset
        label="Reminder time"
        value={
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!enabled}
            aria-label="Reminder time"
            className="cursor-pointer appearance-none bg-transparent text-right text-[13px] font-medium text-neutral-400 outline-none disabled:opacity-50"
          >
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        }
      />
    </>
  )
}
