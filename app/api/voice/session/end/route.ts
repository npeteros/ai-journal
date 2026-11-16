import { NextResponse } from 'next/server'
import { z } from 'zod'

import { aiUsageService } from '@/src/mastra/guardrails/AiUsageService'
import { type VoiceErrorBody } from '@/src/lib/voice'
import { auth } from '@/src/server/auth/auth'

const MAX_BODY_BYTES = 1024

const endSchema = z.object({
  usageId: z.uuid(),
  seconds: z.number().finite().nonnegative(),
})

/**
 * Records how long a voice session lasted on its reserved usage row. Called with fetch when the
 * session ends, or with navigator.sendBeacon when the tab closes (so the body is read as text).
 * The reported length is trusted for v1 but capped server-side; only the row's owner can set it,
 * once.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return new NextResponse(null, { status: 401 })

  let parsed: z.infer<typeof endSchema>
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) throw new Error('Body too large')
    parsed = endSchema.parse(JSON.parse(text))
  } catch {
    return NextResponse.json<VoiceErrorBody>({ error: 'Invalid request' }, { status: 400 })
  }

  await aiUsageService.finalizeVoiceSession({
    usageId: parsed.usageId,
    userId: session.user.id,
    seconds: parsed.seconds,
    success: true,
  })
  return new NextResponse(null, { status: 204 })
}
