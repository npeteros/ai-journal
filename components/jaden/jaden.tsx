'use client'

import { useId } from 'react'
import { cn } from 'cn'

import './jaden.css'
import { JadenRig } from './jaden-rig'
import { JadenSpeechBubble } from './jaden-speech-bubble'
import { useJadenPet } from './use-jaden-pet'
import {
  MOODS,
  PLACEMENTS,
  resolveSize,
  type JadenEntrance,
  type JadenGesture,
  type JadenMood,
  type JadenPlacementKey,
  type JadenSize,
} from './jaden.config'

export type JadenProps = {
  mood?: JadenMood
  gesture?: JadenGesture
  entrance?: JadenEntrance
  /** px, or a named size from SIZES */
  size?: JadenSize
  /** Show the coffee mug (hide it where it'd be odd: typing, recording). */
  mug?: boolean
  /** Speech bubble text, 4 words max. */
  say?: string
  saySide?: 'left' | 'right'
  sayTop?: string
  /** Keep the bubble on screen instead of popping in and out. */
  sayPersist?: boolean
  /** Tap to pet. Renders Jaden as a button. */
  petable?: boolean
  /** false = hold a still pose in the current mood (also automatic under reduced motion). */
  animated?: boolean
  className?: string
}

export function Jaden({
  mood = 'neutral',
  gesture,
  entrance = 'none',
  size = 'inline',
  mug = true,
  say,
  saySide = 'left',
  sayTop,
  sayPersist = false,
  petable = true,
  animated = true,
  className,
}: JadenProps) {
  // useId returns characters that are awkward inside url(#…); keep it to [A-Za-z0-9_-]
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const width = resolveSize(size)
  const { petting, pet } = useJadenPet()

  const classes = cn(
    'mc relative block shrink-0',
    `mood-${mood}`,
    gesture && `g-${gesture}`,
    entrance !== 'none' && `mc-${entrance}`,
    !mug && 'mc-nomug',
    !animated && 'mc-still',
    petable && 'mc-petable',
    className,
  )
  const label = `Jaden, ${MOODS[mood].label.toLowerCase()}.`
  const rig = <JadenRig uid={uid} width={width} />

  return (
    <div className="relative" style={{ width }}>
      {say && (
        <JadenSpeechBubble side={saySide} top={sayTop} persist={sayPersist || !animated}>
          {say}
        </JadenSpeechBubble>
      )}
      {petable ? (
        <button
          type="button"
          className={classes}
          style={{ width }}
          data-petting={petting ? '' : undefined}
          onClick={pet}
          aria-label={`${label} Tap to pet.`}
        >
          {rig}
        </button>
      ) : (
        <div className={classes} style={{ width }}>
          <span className="sr-only">{label}</span>
          {rig}
        </div>
      )}
    </div>
  )
}

/** Jaden configured for a named screen placement (see PLACEMENTS in jaden.config.ts). */
export function JadenFor({
  placement,
  vars,
  ...overrides
}: { placement: JadenPlacementKey; vars?: Record<string, string> } & JadenProps) {
  const config: JadenProps = { ...PLACEMENTS[placement] }
  if (config.say && vars) {
    config.say = config.say.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
  }
  return <Jaden {...config} {...overrides} />
}
