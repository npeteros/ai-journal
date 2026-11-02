'use client'

/**
 * JADEN form controls, built on radix-ui primitives:
 * SegmentedControl (ToggleGroup), Switch, RadioCards (RadioGroup), Checkbox.
 */
import type { ComponentProps, ReactNode } from 'react'
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup,
  Switch as SwitchPrimitive,
  ToggleGroup,
} from 'radix-ui'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from 'cn'

import { SPRING } from '@/components/motion'

type SegmentedOption<T extends string> = { value: T; label: ReactNode }

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Unique per page: the sliding thumb animates between options with this layout id. */
  id: string
  /** "box" = 11px track (Story range); "pill" = small rounded pill (Settings theme) */
  shape?: 'box' | 'pill'
  className?: string
  'aria-label': string
}

/** Neutral track with a raised surface thumb that slides between options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  id,
  shape = 'box',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const pill = shape === 'pill'
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        const next = options.find((o) => o.value === v)
        if (next) onValueChange(next.value)
      }}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex bg-neutral-100',
        pill ? 'rounded-full p-[3px]' : 'rounded-[11px] p-1',
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'relative font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            pill ? 'rounded-full px-4 py-1.5 text-[12px]' : 'rounded-lg px-4 py-2 text-[13px]',
            o.value === value ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-600',
          )}
        >
          {o.value === value && (
            <motion.span
              layoutId={`seg-${id}`}
              transition={SPRING}
              className={cn(
                'absolute inset-0 bg-surface shadow-soft',
                pill ? 'rounded-full' : 'rounded-lg',
              )}
            />
          )}
          <span className={cn('relative', o.value === value && 'font-semibold')}>{o.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full bg-neutral-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:bg-neutral-900',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-[18px] translate-x-[3px] rounded-full bg-surface shadow-soft transition-transform duration-300 ease-spring data-[state=checked]:translate-x-[21px]" />
    </SwitchPrimitive.Root>
  )
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-neutral-300 bg-surface transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:border-neutral-900 data-[state=checked]:bg-neutral-900 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-surface">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

type RadioListOption = { value: string; label: ReactNode; description?: ReactNode }

/** Radio rows inside a card, divided, radio on the right (Right to forget, Language). */
export function RadioList({
  options,
  className,
  ...props
}: Omit<ComponentProps<typeof RadioGroup.Root>, 'children'> & {
  options: readonly RadioListOption[]
}) {
  return (
    <RadioGroup.Root
      className={cn('flex flex-col divide-y divide-neutral-200', className)}
      {...props}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="group flex cursor-pointer items-center justify-between gap-4 px-[18px] py-3.5 transition-colors first:rounded-t-[14px] last:rounded-b-[14px] hover:bg-neutral-100/60"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-neutral-600 group-has-[[data-state=checked]]:text-neutral-900">
              {o.label}
            </span>
            {o.description && <span className="text-[12px] text-neutral-400">{o.description}</span>}
          </span>
          <RadioGroup.Item
            value={o.value}
            className="flex size-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-neutral-200 bg-surface transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:border-neutral-900 data-[state=checked]:bg-neutral-900"
          >
            <RadioGroup.Indicator className="block size-1.5 rounded-full bg-surface" />
          </RadioGroup.Item>
        </label>
      ))}
    </RadioGroup.Root>
  )
}

type OptionCardsProps = Omit<ComponentProps<typeof RadioGroup.Root>, 'children'> & {
  options: readonly { value: string; label: ReactNode; description?: ReactNode; icon?: ReactNode }[]
}

/** Selectable option cards (export format). Selected = sage border + check. */
export function OptionCards({ options, className, ...props }: OptionCardsProps) {
  return (
    <RadioGroup.Root className={cn('grid grid-cols-2 gap-3', className)} {...props}>
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className="group relative flex flex-col items-start gap-1 rounded-[14px] border-[1.5px] border-neutral-200 bg-surface p-4 text-left transition-colors outline-none hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:border-sage-500 data-[state=checked]:bg-sage-100/50"
        >
          {o.icon}
          <span className="text-[14px] font-semibold text-neutral-900">{o.label}</span>
          {o.description && <span className="text-[12px] text-neutral-600">{o.description}</span>}
          <span className="absolute top-3 right-3 hidden size-5 items-center justify-center rounded-full bg-sage-500 text-surface group-data-[state=checked]:flex">
            <Check className="size-3" strokeWidth={3} />
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
