'use client'

import { useState } from 'react'

import { Rise } from '@/components/motion'
import { RadioList } from '@/components/ui/controls'
import { languages } from '@/src/lib/placeholder/settings'

/** Placeholder: language preference isn't persisted yet. */
export function LanguagePicker() {
  const [value, setValue] = useState<string>(languages[0].value)
  return (
    <Rise>
      <div className="lv-card rounded-[14px]">
        <RadioList
          aria-label="Language"
          options={languages}
          value={value}
          onValueChange={setValue}
        />
      </div>
    </Rise>
  )
}
