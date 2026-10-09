// Generates the site icon set from the logo mark in public/logo.svg.
//
//   node scripts/make-icons.mjs
//
// Outputs:
//   app/icon.svg               themed (light/dark) SVG favicon, rounded square
//   app/favicon.ico            16/32/48 px ink-on-paper square (PNG-compressed ICO)
//   app/apple-icon.png         180x180 ink-on-paper, opaque, ~18% padding
//   public/icons/icon-192.png  192x192 ink-on-paper
//   public/icons/icon-512.png  512x512 ink-on-paper
//   public/icons/icon-512-maskable.png  512x512 with maskable safe-zone padding
//
// The mark's path data is read verbatim from public/logo.svg and never redrawn.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOGO_VIEWBOX_W = 349.92
const LOGO_VIEWBOX_H = 235.02

const PAPER = '#f4f1e8'
const INK = '#18211b'
const DARK_PAPER = '#121612'
const DARK_INK = '#ebe7da'

// Pull the raw path data out of the source logo, untouched.
const logoSvg = readFileSync(join(ROOT, 'public/logo.svg'), 'utf8')
const pathData = [...logoSvg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
if (pathData.length === 0) throw new Error('No <path> data found in public/logo.svg')
const pathsXml = pathData.map((d) => `    <path d="${d}"/>`).join('\n')

// Place the mark centered in a square of `size`, with its width equal to
// `widthFraction` of the square.
function markGroup(size, widthFraction, attrs) {
  const w = size * widthFraction
  const s = w / LOGO_VIEWBOX_W
  const tx = (size - w) / 2
  const ty = (size - LOGO_VIEWBOX_H * s) / 2
  return `<g ${attrs} transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(6)})">\n${pathsXml}\n  </g>`
}

// Static raster SVG (light only, opaque square), used for every PNG/ICO output.
function rasterSvg(size, widthFraction, { rounded = false } = {}) {
  const rx = rounded ? Math.round(size * 0.22) : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${PAPER}"/>
  ${markGroup(size, widthFraction, `fill="${INK}"`)}
</svg>`
}

// Themed favicon SVG: rounded paper square with ink mark, dark variant via media query.
const ICON_SIZE = 512
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <style>
    .bg { fill: ${PAPER}; }
    .mark { fill: ${INK}; }
    @media (prefers-color-scheme: dark) {
      .bg { fill: ${DARK_PAPER}; }
      .mark { fill: ${DARK_INK}; }
    }
  </style>
  <rect class="bg" width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${Math.round(ICON_SIZE * 0.22)}"/>
  ${markGroup(ICON_SIZE, 0.62, 'class="mark"')}
</svg>
`

function encodeIco(entries) {
  // entries: [{ size, png }]
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length
  entries.forEach(({ size, png }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o) // width
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1) // height
    dir.writeUInt8(0, o + 2) // palette colors
    dir.writeUInt8(0, o + 3) // reserved
    dir.writeUInt16LE(1, o + 4) // color planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(png.length, o + 8) // image data size
    dir.writeUInt32LE(offset, o + 12) // image data offset
    offset += png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

function toPng(size, widthFraction, opts) {
  return sharp(Buffer.from(rasterSvg(size, widthFraction, opts)), { density: 288 })
    .resize(size, size)
    .flatten({ background: PAPER })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function main() {
  const out = []

  // 1. Themed SVG favicon.
  writeFileSync(join(ROOT, 'app/icon.svg'), iconSvg)
  out.push('app/icon.svg')

  // 2. favicon.ico (16/32/48).
  const icoEntries = []
  for (const size of [16, 32, 48]) {
    icoEntries.push({ size, png: await toPng(size, 0.7) })
  }
  writeFileSync(join(ROOT, 'app/favicon.ico'), encodeIco(icoEntries))
  out.push('app/favicon.ico')

  // 3. apple-icon.png (180, ~18% padding per side => mark width 64%).
  writeFileSync(join(ROOT, 'app/apple-icon.png'), await toPng(180, 0.64))
  out.push('app/apple-icon.png')

  // 4. PWA icons.
  mkdirSync(join(ROOT, 'public/icons'), { recursive: true })
  writeFileSync(join(ROOT, 'public/icons/icon-192.png'), await toPng(192, 0.64))
  writeFileSync(join(ROOT, 'public/icons/icon-512.png'), await toPng(512, 0.64))
  // Maskable: content stays inside the central 80% safe zone (circle radius 40%).
  writeFileSync(join(ROOT, 'public/icons/icon-512-maskable.png'), await toPng(512, 0.5))
  out.push('public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-512-maskable.png')

  console.log(`Wrote ${out.length} icon files (mark paths: ${pathData.length}):`)
  for (const f of out) console.log(`  ${f}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
