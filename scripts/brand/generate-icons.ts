/**
 * Renders Jaden brand assets from `src/lib/brand/jaden-svg.ts`.
 *
 *   npm run brand:icons
 *
 * Re-run after changing Jaden's artwork and commit the outputs. Uses sharp (installed with Next.js).
 *
 *   app/favicon.ico                      16/32/48 px, simplified mark
 *   app/icon.svg                         scalable favicon for modern browsers
 *   app/apple-icon.png                   180 px home-screen icon (iOS adds its own rounding)
 *   public/icons/icon-{192,512}.png      PWA icons
 *   public/icons/icon-maskable-512.png   PWA maskable icon (head inside the 80% safe zone)
 *   public/brand/*                       logo/mascot files for docs, press and email
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

import { jadenFullSvg, jadenMarkSvg } from '@/src/lib/brand/jaden-svg'
import { site } from '@/src/lib/site'

const root = path.resolve(__dirname, '..', '..')
const out = (...p: string[]) => path.join(root, ...p)

async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 72 * Math.max(1, size / 100) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/** ICO container holding PNG-encoded images (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

async function write(file: string, data: string | Buffer) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, data)
  process.stdout.write(`  ${path.relative(root, file)}\n`)
}

async function main() {
  const { paper } = site.colors
  const mark = jadenMarkSvg()
  const smallMark = jadenMarkSvg({ detail: false })
  const appIcon = jadenMarkSvg({ background: paper, padding: 0.08 })
  const appleIcon = jadenMarkSvg({ background: paper, radius: 0, padding: 0.12 })
  const maskable = jadenMarkSvg({ background: paper, radius: 0, padding: 0.22 })
  const full = jadenFullSvg()

  process.stdout.write('Writing Jaden brand assets:\n')

  await write(
    out('app', 'favicon.ico'),
    ico(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({ size, data: await png(smallMark, size) })),
      ),
    ),
  )
  await write(out('app', 'icon.svg'), mark)
  await write(out('app', 'apple-icon.png'), await png(appleIcon, 180))

  await write(out('public', 'icons', 'icon-192.png'), await png(appIcon, 192))
  await write(out('public', 'icons', 'icon-512.png'), await png(appIcon, 512))
  await write(out('public', 'icons', 'icon-maskable-512.png'), await png(maskable, 512))

  await write(out('public', 'brand', 'jaden-mark.svg'), mark)
  await write(out('public', 'brand', 'jaden-mark-512.png'), await png(mark, 512))
  await write(out('public', 'brand', 'jaden.svg'), full)
  await write(
    out('public', 'brand', 'jaden-1024.png'),
    await sharp(Buffer.from(full), { density: 72 * 6.4 })
      .resize({ width: 1024 })
      .png()
      .toBuffer(),
  )
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.exit(1)
})
