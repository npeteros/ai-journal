import { ImageResponse } from 'next/og'

import { jadenFullSvg, svgDataUri } from '@/src/lib/brand/jaden-svg'
import { site } from '@/src/lib/site'

export const shareImageSize = { width: 1200, height: 630 }
export const shareImageAlt =
  'Jaden the teddy bear peeking over a journal, next to "Reflect deeper, every day."'

const BEAR_WIDTH = 440
const BEAR_HEIGHT = Math.round((BEAR_WIDTH * 152) / 160)
/** Where the rig's ledge line (y = 140 of 152) lands, in px from the bear's top. */
const LEDGE = Math.round((BEAR_HEIGHT * 140) / 152)

const SUBLINE =
  'A calm daily journal with an AI companion. Private, and never used to train models.'

/** A Google Font subset for the given text; null (default font) if Google Fonts is unreachable. */
async function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@500&text=${encodeURIComponent(text)}`,
    ).then((res) => res.text())
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    if (!src) return null
    const res = await fetch(src)
    return res.ok ? res.arrayBuffer() : null
  } catch {
    return null
  }
}

export async function renderShareImage() {
  const { colors } = site
  const headline = site.tagline
  const [serif, sans] = await Promise.all([
    loadFont('Newsreader', `${headline}${site.name}`),
    loadFont('Manrope', SUBLINE),
  ])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: colors.paper,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -160,
          right: 120,
          width: 520,
          height: 520,
          borderRadius: 9999,
          background: colors.sageTint,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -220,
          right: -120,
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: colors.cloudTint,
        }}
      />

      {/* Copy */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 28,
          width: 640,
          paddingLeft: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: serif ? 'Newsreader' : undefined,
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: 2,
            color: colors.ink,
          }}
        >
          {site.name}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: serif ? 'Newsreader' : undefined,
            fontSize: 76,
            fontWeight: 500,
            lineHeight: 1.08,
            color: colors.ink,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: sans ? 'Manrope' : undefined,
            fontSize: 27,
            lineHeight: 1.5,
            color: colors.inkMuted,
          }}
        >
          {SUBLINE}
        </div>
      </div>

      {/* Jaden peeking over a journal card */}
      <div
        style={{
          position: 'absolute',
          right: 70,
          bottom: 0,
          width: 470,
          height: 170,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          background: colors.surface,
          boxShadow: '0 -6px 30px rgba(60, 40, 20, 0.12)',
        }}
      />
      {/* oxlint-disable-next-line nextjs/no-img-element -- Satori (ImageResponse) only renders plain <img> */}
      <img
        src={svgDataUri(jadenFullSvg())}
        width={BEAR_WIDTH}
        height={BEAR_HEIGHT}
        alt=""
        style={{ position: 'absolute', right: 85, bottom: 170 - (BEAR_HEIGHT - LEDGE) }}
      />
    </div>,
    {
      ...shareImageSize,
      fonts: [
        ...(serif ? [{ name: 'Newsreader', data: serif, weight: 500 as const }] : []),
        ...(sans ? [{ name: 'Manrope', data: sans, weight: 500 as const }] : []),
      ],
    },
  )
}
