import type { CSSProperties, ReactNode } from 'react'
import { cn } from 'cn'

import { belowEdge } from './jaden.config'

type JadenPerchProps = {
  /** Jaden's width in px — needed to line his ledge (y = EDGE_Y) up with the parent's top edge. */
  width: number
  /** Horizontal position inside the parent, e.g. { right: 24 } or { left: '52%' }. Omit to position with className. */
  position?: Pick<CSSProperties, 'left' | 'right'>
  /** Extra vertical offset from the parent's top edge. */
  top?: CSSProperties['top']
  className?: string
  children: ReactNode
}

/**
 * Perches Jaden on the top edge of the nearest positioned ancestor, so he peeks over it with
 * his paws and mug resting on the edge. The parent must be `relative` and must not clip
 * (`overflow-hidden`) its top edge.
 */
export function JadenPerch({ width, position, top = 0, className, children }: JadenPerchProps) {
  return (
    <div
      className={cn('pointer-events-none absolute z-[3] h-0', className)}
      style={{ ...position, top, width }}
    >
      <div className="pointer-events-auto absolute left-0" style={{ bottom: -belowEdge(width) }}>
        {children}
      </div>
    </div>
  )
}
