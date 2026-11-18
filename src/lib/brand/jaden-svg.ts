/**
 * Static Jaden artwork as SVG strings, for brand assets (logo, favicons, app icons, OG images).
 *
 * The animated in-app mascot lives in `components/jaden/jaden-rig.tsx`; this is a still,
 * self-contained copy of the same geometry with OKLCH tokens and CSS variables converted to hex,
 * because image renderers (sharp, Satori) can't resolve either. Keep the two in sync when Jaden's
 * look changes, then re-run `npm run brand:icons`.
 */

const C = {
  furDark: '#9c6644',
  furHi: '#e6c092',
  furMid: '#ca9566',
  furLo: '#9f6442',
  shade: '#633c2e',
  line: '#5d3728',
  earInner: '#efc7b9',
  seam: '#794b37',
  stitch: '#7e5239',
  muzHi: '#e8d4bb',
  muzLo: '#ccae94',
  ink: '#4e2f24',
  eye: '#1e130f',
  belly: '#dfcab2',
  arm: '#c18b5e',
  paw: '#e7d5bb',
  pawLine: '#a87b5d',
  mug: '#f6f2e7',
  mugRim: '#f2eee3',
  coffee: '#68432f',
  steam: '#d1c9bc',
  sage200: '#afe4b9',
  sage500: '#4d9965',
  sage700: '#205431',
  rose500: '#cb6c6d',
} as const

const HEAD =
  'M38 82 C38 58 56 45 80 45 C104 45 122 58 122 82 C122 102 104 114 80 114 C56 114 38 102 38 82Z'

function defs(id: string) {
  return `<defs>
  <radialGradient id="${id}fur" cx=".38" cy=".3" r=".9">
    <stop offset="0%" stop-color="${C.furHi}"/><stop offset="55%" stop-color="${C.furMid}"/><stop offset="100%" stop-color="${C.furLo}"/>
  </radialGradient>
  <linearGradient id="${id}shade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="45%" stop-color="${C.shade}" stop-opacity="0"/><stop offset="100%" stop-color="${C.shade}" stop-opacity=".32"/>
  </linearGradient>
  <radialGradient id="${id}muz" cx=".45" cy=".35" r=".8">
    <stop offset="0%" stop-color="${C.muzHi}"/><stop offset="100%" stop-color="${C.muzLo}"/>
  </radialGradient>
  <radialGradient id="${id}shadow">
    <stop offset="0%" stop-color="#000" stop-opacity=".32"/><stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="${id}clip"><rect x="-40" y="-80" width="240" height="220"/></clipPath>
</defs>`
}

/** Jaden's head: ears, leaf, face. Open eyes and a soft smile read well down to 16px. */
function head(id: string, { detail }: { detail: boolean }) {
  const eyes = [62, 98]
    .map(
      (x) =>
        `<circle cx="${x}" cy="82" r="${detail ? 5.6 : 6.4}" fill="${C.eye}"/>` +
        `<circle cx="${x + 2}" cy="80" r="${detail ? 2.1 : 2.3}" fill="#fff"/>` +
        (detail ? `<circle cx="${x - 1.4}" cy="84.4" r=".9" fill="#fff" opacity=".8"/>` : ''),
    )
    .join('')

  return `<g>
  <circle cx="51" cy="53" r="11" fill="${C.furDark}"/><circle cx="52" cy="54.5" r="6" fill="${C.earInner}"/>
  <circle cx="109" cy="53" r="11" fill="${C.furDark}"/><circle cx="108" cy="54.5" r="6" fill="${C.earInner}"/>
  <path d="${HEAD}" fill="url(#${id}fur)"/>
  <path d="${HEAD}" fill="url(#${id}shade)"/>
  ${
    detail
      ? `<g fill="none" stroke="${C.seam}" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"><path d="M39.5 90 q-2.5 2 -1 5"/><path d="M120.5 90 q2.5 2 1 5"/></g>`
      : ''
  }
  <path d="${HEAD}" fill="none" stroke="${C.line}" stroke-opacity=".38" stroke-width="1.3"/>
  ${
    detail
      ? `<path d="M80 50 C79 60 79 72 80 84" fill="none" stroke="${C.stitch}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="2.4 2.6" stroke-linecap="round"/>`
      : ''
  }
  <path d="M71 47.5 Q74 39 80 46 Q85 39 89 47.5" fill="none" stroke="${C.furDark}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M80 46 Q78.5 37 82 30" fill="none" stroke="${C.sage700}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M82 31 C87 21 99 21 103 25 C98 34 87 36 82 31Z" fill="${C.sage500}"/>
  <path d="M83 30.5 Q92 27 100 25.5" fill="none" stroke="${C.sage700}" stroke-width=".9" stroke-opacity=".6"/>
  <path d="M81 35 C75 28 67 29 65 32 C70 38 77 38 81 35Z" fill="${C.sage200}"/>
  <ellipse cx="54" cy="95" rx="7.5" ry="4.5" fill="${C.rose500}" opacity=".45"/>
  <ellipse cx="106" cy="95" rx="7.5" ry="4.5" fill="${C.rose500}" opacity=".45"/>
  <ellipse cx="80" cy="97" rx="16.5" ry="12" fill="url(#${id}muz)"/>
  <path d="M73.5 90 C73.5 87.6 76.5 87 80 87 C83.5 87 86.5 87.6 86.5 90 C86.5 93 83 96 80 96 C77 96 73.5 93 73.5 90Z" fill="${C.ink}"/>
  <ellipse cx="77.6" cy="89" rx="2.4" ry=".9" fill="#fff" opacity=".5"/>
  <path d="M80 96 V100.5" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M73 100.5 Q76.5 106.5 80 101 Q83.5 106.5 87 100.5" fill="none" stroke="${C.ink}" stroke-width="1.7" stroke-linecap="round"/>
  ${eyes}
</g>`
}

/** Head bounds (ears, leaf, cheeks) in rig units, padded into a square. */
const MARK_VIEWBOX = { x: 30, y: 17, size: 100 } as const

type MarkOptions = {
  /** Output width/height attributes. Omit for a fluid SVG. */
  size?: number
  /** Fill the square with a rounded tile of this color. */
  background?: string
  /** Corner radius of the tile as a fraction of its size (0 = square, for maskable icons). */
  radius?: number
  /** Fraction of the canvas left empty on each side around the head. */
  padding?: number
  /** Drop fine lines that turn to noise at favicon sizes. */
  detail?: boolean
}

/** The Jaden head mark: logo, favicon and app icons. */
export function jadenMarkSvg({
  size,
  background,
  radius = 0.22,
  padding = 0,
  detail = true,
}: MarkOptions = {}): string {
  const id = 'jm'
  const pad = MARK_VIEWBOX.size * padding
  const box = MARK_VIEWBOX.size + pad * 2
  const x = MARK_VIEWBOX.x - pad
  const y = MARK_VIEWBOX.y - pad
  const dims = size ? ` width="${size}" height="${size}"` : ''
  const tile = background
    ? `<rect x="${x}" y="${y}" width="${box}" height="${box}" rx="${box * radius}" fill="${background}"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${box} ${box}"${dims}>
${defs(id)}
${tile}
${head(id, { detail })}
</svg>`
}

/** Full Jaden peeking over a ledge with the coffee mug: hero art and share images. */
export function jadenFullSvg({ width }: { width?: number } = {}): string {
  const id = 'jf'
  const dims = width ? ` width="${width}" height="${Math.round((width * 152) / 160)}"` : ''
  const steam = `<g fill="none" stroke="${C.steam}" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M23 111 q-3 -5 0 -9 q3 -4 0 -8"/><path d="M30 110 q-3 -5 0 -9 q3 -4 0 -8"/><path d="M37 111 q-3 -5 0 -9 q3 -4 0 -8"/></g>`
  const pawLines = (cx: number) =>
    `<path d="M${cx - 3.5} 136.5v3M${cx} 136v3.5M${cx + 3.5} 136.5v3" stroke="${C.pawLine}" stroke-width="1.4" stroke-linecap="round"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 152"${dims}>
${defs(id)}
<g clip-path="url(#${id}clip)">
  <ellipse cx="80" cy="154" rx="58" ry="44" fill="url(#${id}fur)"/>
  <ellipse cx="80" cy="154" rx="58" ry="44" fill="url(#${id}shade)"/>
  <ellipse cx="80" cy="142" rx="28" ry="20" fill="${C.belly}" opacity=".75"/>
  <ellipse cx="80" cy="154" rx="58" ry="44" fill="none" stroke="${C.line}" stroke-opacity=".38" stroke-width="1.3"/>
  ${head(id, { detail: true })}
</g>
<ellipse cx="40" cy="145" rx="24" ry="5.5" fill="url(#${id}shadow)"/>
<ellipse cx="107" cy="145" rx="14" ry="5" fill="url(#${id}shadow)"/>
${steam}
<path d="M17 122 h-3 a6 6 0 0 0 0 12 h3" fill="none" stroke="${C.mugRim}" stroke-width="3.5"/>
<rect x="17" y="114" width="26" height="27" rx="6" fill="${C.mug}"/>
<rect x="35" y="114" width="8" height="27" rx="4" fill="#000" opacity=".07"/>
<rect x="17" y="125" width="26" height="6" fill="${C.sage500}"/>
<ellipse cx="30" cy="115" rx="11.5" ry="2.3" fill="${C.coffee}"/>
<path d="M46 110 C41 119 42 131 47 139 L59 139 C60.5 130 59 119 55 110 Z" fill="${C.arm}"/>
<ellipse cx="53" cy="140.5" rx="9" ry="6.8" fill="${C.paw}"/>
${pawLines(53)}
<path d="M105 110 C101 119 100 130 101 139 L113 139 C118 131 119 119 114 110 Z" fill="${C.arm}"/>
<ellipse cx="107" cy="140.5" rx="9" ry="6.8" fill="${C.paw}"/>
${pawLines(107)}
</svg>`
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
