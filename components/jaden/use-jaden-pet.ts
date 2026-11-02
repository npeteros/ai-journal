'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PET_DURATION_MS } from './jaden.config'

/**
 * Tap-to-pet: Jaden hops and shows a happy face for PET_DURATION_MS.
 * Re-tapping mid-reaction restarts it: the attribute is cleared for a frame so the CSS
 * animations replay, without remounting the rig (which would replay the entrance too).
 */
export function useJadenPet() {
  const [petting, setPetting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frame = useRef<number | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    if (frame.current) cancelAnimationFrame(frame.current)
  }

  const pet = useCallback(() => {
    clear()
    setPetting(false)
    // Two frames: let the browser apply the "not petting" style before re-adding it.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        setPetting(true)
        timer.current = setTimeout(() => setPetting(false), PET_DURATION_MS)
      })
    })
  }, [])

  useEffect(() => clear, [])

  return { petting, pet }
}
