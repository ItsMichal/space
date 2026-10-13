// Build-time image pipeline. Reads every raster in public/media and writes responsive
// AVIF + WebP variants to public/media/_v/, plus lib/media/manifest.json with intrinsic size,
// dominant color and a tiny base64 blur placeholder (LQIP) per image.
//
// Outputs are generated, not committed (both are gitignored). Cloudflare's build runs
// `npm run deploy` -> `opennextjs-cloudflare build` -> `npm run build`, which triggers `prebuild`,
// and sharp ships prebuilt linux binaries, so no extra setup is needed. Unchanged sources are
// skipped by hash of source bytes + encoder settings, so repeat builds are fast. CI caches public/media/_v, public/media/_og,
// lib/media/manifest.json and .cache/ (see .github/actions/restore-media-cache) so warm runs only touch changed sources.
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
// Paths below are relative to the app root; make that true whatever directory the script is launched from.
process.chdir(new URL('..', import.meta.url).pathname)

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'public', 'media')
const OUT = path.join(SRC, '_v')
const MANIFEST = path.join(ROOT, 'lib', 'media', 'manifest.json')
const WIDTHS = [480, 960, 1600, 2400]
const MAX_WIDTH = 2400
const OPTS = { avif: { quality: 52, effort: 4 }, webp: { quality: 78, effort: 5 }, lqip: { w: 24, blur: 1.2, quality: 45 } }
const FORMATS = {
  avif: (s) => s.avif(OPTS.avif),
  webp: (s) => s.webp(OPTS.webp),
}
// Bump REV when the pipeline changes in a way the options above do not capture. Folded into every output hash.
const REV = 1
const SETTINGS = JSON.stringify({ REV, WIDTHS, MAX_WIDTH, OPTS })
const sha = (...parts) => {
  const h = crypto.createHash('sha1')
  for (const p of parts) h.update(p)
  return h.digest('hex').slice(0, 16)
}
const RASTER = /\.(png|jpe?g|webp|gif|avif)$/i

const walk = (dir) =>
  !fs.existsSync(dir)
    ? []
    : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        if (e.name.startsWith('_') || e.name.startsWith('.')) return []
        const p = path.join(dir, e.name)
        return e.isDirectory() ? walk(p) : RASTER.test(e.name) ? [p] : []
      })

const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}
const manifest = {}
const keep = new Set()
let made = 0
let skipped = 0

/** Widths to emit: the preset steps clearly below the source width, plus the source width itself (capped). Never upscale. */
function widthsFor(w) {
  const cap = Math.min(w, MAX_WIDTH)
  return [...WIDTHS.filter((x) => x < cap * 0.92), cap]
}

for (const file of walk(SRC).sort()) {
  const rel = path.relative(SRC, file).split(path.sep).join('/')
  const key = `/media/${rel}`
  const buf = fs.readFileSync(file)
  const hash = sha(buf, SETTINGS)
  const meta = await sharp(buf, { animated: true }).metadata()
  const animated = (meta.pages ?? 1) > 1
  const width = meta.width
  const height = animated ? meta.pageHeight : meta.height

  const stem = rel.replace(/\.[^.]+$/, '')
  const dir = path.dirname(stem)
  const name = path.basename(stem)
  const ws = animated ? [] : widthsFor(width)
  const variants = { avif: [], webp: [] }
  for (const fmt of Object.keys(FORMATS)) {
    for (const w of ws) variants[fmt].push({ w, src: `/media/_v/${dir}/${name}-${w}.${fmt}` })
  }
  for (const list of Object.values(variants)) for (const v of list) keep.add(path.join(ROOT, 'public', v.src))

  const old = prev[key]
  const complete =
    old && old.hash === hash && Object.values(variants).flat().every((v) => fs.existsSync(path.join(ROOT, 'public', v.src)))
  if (complete) {
    manifest[key] = old
    skipped++
    continue
  }

  const still = () => sharp(buf, { animated: false }).rotate()
  // 1x1 average for the dominant color, 24px blurred webp for the placeholder.
  const px = await still().resize(1, 1, { fit: 'cover' }).removeAlpha().raw().toBuffer()
  const color = '#' + [...px.subarray(0, 3)].map((n) => n.toString(16).padStart(2, '0')).join('')
  const lq = await still().resize(OPTS.lqip.w).blur(OPTS.lqip.blur).webp({ quality: OPTS.lqip.quality }).toBuffer()
  const lqip = `data:image/webp;base64,${lq.toString('base64')}`

  fs.mkdirSync(path.join(OUT, dir), { recursive: true })
  await Promise.all(
    Object.entries(FORMATS).flatMap(([fmt, enc]) =>
      variants[fmt].map(({ w, src }) =>
        enc(still().resize({ width: w, withoutEnlargement: true })).toFile(path.join(ROOT, 'public', src))
      )
    )
  )
  manifest[key] = { w: width, h: height, color, lqip, hash, animated, variants }
  made++
}

// Share-card covers: next/og cannot read WebP (and must not embed a multi-MB original), so every post that has a cover
// gets a small JPEG crop in public/media/_og/<slug>.jpg (456x534, the right-hand panel of the card, honouring `coverFocus`).
// app/**/opengraph-image.tsx (lib/og.tsx) reads these at build time and renders the 1200x630 PNG card from them.
const OG = path.join(SRC, '_og')
const PAPER = '#f4f1e8'
const OG_W = 456
const OG_H = 534
const POSTS = path.join(ROOT, 'content', 'posts')
const fm = (text, key) => text.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1].replace(/^["']|["']$/g, '')
const ogJobs = fs
  .readdirSync(POSTS)
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) => {
    const text = fs.readFileSync(path.join(POSTS, f), 'utf8')
    const slug = fm(text, 'slug')
    const cover = fm(text, 'cover')
    if (!slug || !cover || cover === 'none') return []
    return [{ from: path.join(ROOT, 'public', cover), to: path.join(OG, `${slug}.jpg`), focus: fm(text, 'coverFocus') }]
  })
// Stamps (source hash + settings) live outside public/ so they are not shipped; mtimes are useless after a CI checkout.
const STAMPS = path.join(ROOT, '.cache', 'build-images', 'og.json')
const rk = (p) => path.relative(ROOT, p).split(path.sep).join('/')
const stamps = fs.existsSync(STAMPS) ? JSON.parse(fs.readFileSync(STAMPS, 'utf8')) : {}
const nextStamps = {}
const ogKeep = new Set()
let ogMade = 0
for (const { from, to, focus } of ogJobs) {
  if (!fs.existsSync(from)) continue
  ogKeep.add(to)
  const stamp = sha(fs.readFileSync(from), SETTINGS, PAPER, `${OG_W}x${OG_H}`, focus ?? '', 'og2')
  nextStamps[rk(to)] = stamp
  if (fs.existsSync(to) && stamps[rk(to)] === stamp) continue
  fs.mkdirSync(path.dirname(to), { recursive: true })
  const img = sharp(from).rotate().flatten({ background: PAPER })
  let out
  if (focus && /^\d+%\s+\d+%$/.test(focus)) {
    // CSS object-position: scale to fill, then take the window at that fraction of the overflow.
    const [fx, fy] = focus.split(/\s+/).map((v) => parseFloat(v) / 100)
    const { info } = await img.clone().resize(OG_W, OG_H, { fit: 'outside' }).toBuffer({ resolveWithObject: true })
    const buf = await img.clone().resize(OG_W, OG_H, { fit: 'outside' }).toBuffer()
    out = sharp(buf).extract({ left: Math.round((info.width - OG_W) * fx), top: Math.round((info.height - OG_H) * fy), width: OG_W, height: OG_H })
  } else {
    out = img.resize(OG_W, OG_H, { fit: 'cover', position: 'attention' })
  }
  await out.jpeg({ quality: 82, mozjpeg: true }).toFile(to)
  ogMade++
}
fs.mkdirSync(path.dirname(STAMPS), { recursive: true })
fs.writeFileSync(STAMPS, JSON.stringify(nextStamps))

// Prune variants whose source is gone or renamed.
const prune = (dir, keepSet = keep) => {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      prune(p, keepSet)
      if (!fs.readdirSync(p).length) fs.rmdirSync(p)
    } else if (!keepSet.has(p)) fs.unlinkSync(p)
  }
}
prune(OUT)
prune(OG, ogKeep)

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
fs.writeFileSync(MANIFEST, JSON.stringify(manifest) + '\n')
console.log(`build-images: ${made} processed, ${skipped} cached, ${Object.keys(manifest).length} total; share cards: ${ogMade} made, ${ogKeep.size - ogMade} cached`)
