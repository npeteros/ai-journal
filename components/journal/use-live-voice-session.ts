'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  VOICE_GREETING_CUE,
  VOICE_LIMIT_CODE,
  VOICE_SESSION_API,
  VOICE_SESSION_END_API,
  type VoiceSessionEndRequest,
  type VoiceSessionResponse,
  type VoiceTurn,
} from '@/src/lib/voice'
import { toTurns, type TranscriptDelta } from '@/src/lib/voice-transcript'

/**
 * Spoken journaling session with GPT-Live over WebRTC. The server creates the session (our key,
 * Jaden's fixed instructions); this hook owns the microphone, the peer connection and the
 * `oai-events` data channel. Audio flows over the media tracks and is never recorded or stored;
 * only the transcript deltas are kept, in memory.
 */

export type LiveVoicePhase = 'idle' | 'starting' | 'live' | 'ending' | 'ended' | 'failed'

export type LiveVoiceError =
  'mic-denied' | 'mic-unavailable' | 'limit' | 'unavailable' | 'connection-lost'

/** Someone counts as "speaking" for this long after their last transcribed word arrives. */
const SPEAKING_HOLD_MS = 1200
const ICE_GATHERING_TIMEOUT_MS = 3000
const CLOSE_TIMEOUT_MS = 2000
const TICK_MS = 250

type ServerEvent = { type?: unknown; delta?: unknown; start_ms?: unknown; usage?: unknown }

function readSeconds(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null || !('seconds' in usage)) return null
  return typeof usage.seconds === 'number' ? usage.seconds : null
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body: unknown = await res.json()
    if (typeof body === 'object' && body !== null && 'code' in body) {
      return typeof body.code === 'string' ? body.code : undefined
    }
  } catch {
    // Non-JSON error body.
  }
  return undefined
}

function sendEvent(dc: RTCDataChannel | null, event: Record<string, unknown>) {
  if (dc?.readyState === 'open') dc.send(JSON.stringify(event))
}

export function useLiveVoiceSession() {
  const [phase, setPhaseState] = useState<LiveVoicePhase>('idle')
  const [error, setError] = useState<LiveVoiceError | null>(null)
  const [deltas, setDeltas] = useState<TranscriptDelta[]>([])
  const [muted, setMuted] = useState(false)
  const [maxSeconds, setMaxSeconds] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [lastHeard, setLastHeard] = useState({ jaden: 0, user: 0 })
  const [now, setNow] = useState(() => Date.now())

  // Callbacks read the phase synchronously, so it's mirrored in a ref updated with the state.
  const phaseRef = useRef<LiveVoicePhase>('idle')
  const setPhase = useCallback((next: LiveVoicePhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const usageIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const openAiSecondsRef = useRef<number | null>(null)
  const reportedRef = useRef(false)
  const closedRef = useRef<(() => void) | null>(null)
  const startMsOffsetRef = useRef(0)
  const deltasRef = useRef<TranscriptDelta[]>([])

  /** Session length to record: OpenAI's own count when we have it, else our clock. */
  const reportUsage = useCallback((viaBeacon = false) => {
    const usageId = usageIdRef.current
    if (!usageId || reportedRef.current) return
    reportedRef.current = true
    const startedAtMs = startedAtRef.current
    const seconds =
      openAiSecondsRef.current ?? (startedAtMs === null ? 0 : (Date.now() - startedAtMs) / 1000)
    const payload = JSON.stringify({ usageId, seconds } satisfies VoiceSessionEndRequest)
    if (viaBeacon && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(VOICE_SESSION_END_API, new Blob([payload], { type: 'text/plain' }))
      return
    }
    void fetch(VOICE_SESSION_END_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Best-effort: the reserved usage row stays as an unfinished session.
    })
  }, [])

  const teardown = useCallback(() => {
    dcRef.current?.close()
    pcRef.current?.close()
    micRef.current?.getTracks().forEach((track) => track.stop())
    if (audioRef.current) audioRef.current.srcObject = null
    dcRef.current = null
    pcRef.current = null
    micRef.current = null
  }, [])

  const finish = useCallback(
    (failure?: LiveVoiceError) => {
      if (phaseRef.current === 'ended' || phaseRef.current === 'failed') return
      teardown()
      reportUsage()
      if (failure) setError(failure)
      setPhase(failure ? 'failed' : 'ended')
    },
    [reportUsage, setPhase, teardown],
  )

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      const { type, delta } = event
      if (type === 'session.started') {
        const at = Date.now()
        startedAtRef.current = at
        setStartedAt(at)
        setPhase('live')
        // Jaden waits for the user to speak unless cued, and silence is billed.
        sendEvent(dcRef.current, {
          type: 'session.commentary.append',
          delegation_id: null,
          content: VOICE_GREETING_CUE,
        })
      } else if (
        (type === 'session.input_transcript.delta' || type === 'session.output_transcript.delta') &&
        typeof delta === 'string'
      ) {
        const role = type === 'session.input_transcript.delta' ? 'user' : 'jaden'
        const startMs =
          typeof event.start_ms === 'number'
            ? event.start_ms + startMsOffsetRef.current
            : (deltasRef.current.at(-1)?.startMs ?? startMsOffsetRef.current)
        const next = { role, text: delta, startMs } as const
        deltasRef.current = [...deltasRef.current, next]
        setDeltas(deltasRef.current)
        setLastHeard((prev) => ({ ...prev, [role]: Date.now() }))
      } else if (type === 'session.usage.updated') {
        openAiSecondsRef.current = readSeconds(event.usage) ?? openAiSecondsRef.current
      } else if (type === 'session.closed') {
        openAiSecondsRef.current = readSeconds(event.usage) ?? openAiSecondsRef.current
        closedRef.current?.()
        // Every close reason ends the conversation; the transcript so far can still be drafted.
        finish()
      }
    },
    [finish, setPhase],
  )

  const start = useCallback(async () => {
    if (!['idle', 'ended', 'failed'].includes(phaseRef.current)) return
    // A new session's transcript clock restarts at 0; keep its turns after the earlier ones.
    startMsOffsetRef.current = deltasRef.current.reduce(
      (latest, delta) => Math.max(latest, delta.startMs + 1),
      0,
    )
    setPhase('starting')
    setError(null)
    reportedRef.current = false
    openAiSecondsRef.current = null
    usageIdRef.current = null
    startedAtRef.current = null
    setStartedAt(null)

    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError'
      setError(denied ? 'mic-denied' : 'mic-unavailable')
      setPhase('failed')
      return
    }
    micRef.current = mic
    mic.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })

    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      // Jaden's voice plays from an element that isn't in the DOM; a fresh one per session.
      const audio = new Audio()
      audio.autoplay = true
      audioRef.current = audio
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0] ?? null
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') finish('connection-lost')
      }
      for (const track of mic.getAudioTracks()) pc.addTrack(track, mic)

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = (message) => {
        let event: ServerEvent
        try {
          event = JSON.parse(String(message.data)) as ServerEvent
        } catch {
          return
        }
        handleEvent(event)
      }
      dc.onclose = () => {
        if (phaseRef.current === 'live') finish('connection-lost')
      }

      await pc.setLocalDescription(await pc.createOffer())
      await waitForIceGathering(pc)

      const res = await fetch(VOICE_SESSION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: pc.localDescription?.sdp }),
      })
      if (!res.ok) {
        const code = await readErrorCode(res)
        teardown()
        setError(code === VOICE_LIMIT_CODE ? 'limit' : 'unavailable')
        setPhase('failed')
        return
      }
      const session = (await res.json()) as VoiceSessionResponse
      usageIdRef.current = session.usageId
      setMaxSeconds(session.maxSeconds)
      await pc.setRemoteDescription({ type: 'answer', sdp: session.sdp })
    } catch {
      finish('unavailable')
    }
  }, [finish, handleEvent, muted, setPhase, teardown])

  /** Asks OpenAI to close the session, then tears down even if no confirmation arrives. */
  const end = useCallback(async () => {
    if (phaseRef.current !== 'live' && phaseRef.current !== 'starting') return
    setPhase('ending')
    const dc = dcRef.current
    if (dc?.readyState === 'open') {
      await new Promise<void>((resolve) => {
        closedRef.current = resolve
        setTimeout(resolve, CLOSE_TIMEOUT_MS)
        sendEvent(dc, { type: 'session.close' })
      })
    }
    finish()
  }, [finish, setPhase])

  /** Mutes locally by disabling the mic track (the browser isn't allowed to send mute events). */
  const toggleMute = useCallback(() => {
    const next = !muted
    micRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next
    })
    setMuted(next)
  }, [muted])

  // Clock for the countdown and the speaking indicators.
  useEffect(() => {
    if (phase !== 'live') return
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [phase])

  const remainingSeconds =
    startedAt !== null && maxSeconds > 0
      ? Math.max(0, Math.ceil(maxSeconds - (now - startedAt) / 1000))
      : maxSeconds

  // Enforce the session cap.
  useEffect(() => {
    if (phase === 'live' && maxSeconds > 0 && remainingSeconds <= 0) void end()
  }, [end, maxSeconds, phase, remainingSeconds])

  // Closing the tab mid-session: close it and report usage with a beacon (fetch may be cancelled).
  useEffect(() => {
    const onPageHide = () => {
      if (phaseRef.current === 'live' || phaseRef.current === 'ending') {
        sendEvent(dcRef.current, { type: 'session.close' })
        reportUsage(true)
      }
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [reportUsage])

  // Navigating away inside the app ends the session.
  useEffect(
    () => () => {
      if (['starting', 'live', 'ending'].includes(phaseRef.current)) {
        sendEvent(dcRef.current, { type: 'session.close' })
        teardown()
        reportUsage()
      }
    },
    [reportUsage, teardown],
  )

  const turns: VoiceTurn[] = useMemo(() => toTurns(deltas), [deltas])

  return {
    phase,
    error,
    turns,
    muted,
    remainingSeconds,
    jadenSpeaking: phase === 'live' && now - lastHeard.jaden < SPEAKING_HOLD_MS,
    userSpeaking: phase === 'live' && now - lastHeard.user < SPEAKING_HOLD_MS,
    start,
    end,
    toggleMute,
  }
}
