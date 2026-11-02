import type { CSSProperties } from 'react'
import { cn } from 'cn'

type JadenSpeechBubbleProps = {
  /** Short and warm: 4 words max. */
  children: string
  /** Which side of Jaden the bubble sits on. */
  side?: 'left' | 'right'
  /** Vertical offset from the top of Jaden, CSS length. */
  top?: string
  /** Keep the bubble visible instead of popping in and fading out. */
  persist?: boolean
  className?: string
}

export function JadenSpeechBubble({
  children,
  side = 'left',
  top = '6px',
  persist = false,
  className,
}: JadenSpeechBubbleProps) {
  const style: CSSProperties =
    side === 'left' ? { right: 'calc(100% - 18px)', top } : { left: 'calc(100% - 18px)', top }

  return (
    <div
      className={cn('mc-say z-10', persist ? 'mc-say-persist' : 'mc-live-say', className)}
      style={style}
    >
      {children}
    </div>
  )
}
