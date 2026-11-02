/** AI presence: the breathing orb, glinting text on words JADEN wrote, and typing dots. */
import type { ComponentProps } from 'react'
import { cn } from 'cn'

export function Orb({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('lv-orb inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function GlintText({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('lv-glint', className)} {...props} />
}

/** "JADEN" label with orb, as used above AI-written content. */
export function AiLabel({
  children = 'JADEN',
  className,
}: {
  children?: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Orb size={12} />
      <GlintText className="text-[11px] font-bold tracking-[0.08em] uppercase">
        {children}
      </GlintText>
    </span>
  )
}

export function TypingIndicator({ label, className }: { label?: string; className?: string }) {
  return (
    <output className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="lv-typing" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {label && <span className="text-[12px] font-medium text-neutral-400">{label}</span>}
    </output>
  )
}
