// One-off: makes the web-sized About portrait derivatives from the owner-supplied original (kept out of the repo).
// Usage: node scripts/make-about-portrait.mjs <path to original 1500x2000 WebP>
// Outputs public/media/about/portrait.webp (900x1200, 3:4, the card photo) and portrait-4x5.jpg (800x1000, JSON-LD image).
// No withMetadata(): sharp then writes no EXIF, XMP, IPTC or ICC profile (the output is converted to sRGB first), so no GPS,
// device or timestamp data survives. The script prints what is left so it can be checked.
import sharp from 'sharp'

const src = process.argv[2]
if (!src) throw new Error('usage: node scripts/make-about-portrait.mjs <original>')
const before = await sharp(src).metadata()
console.log('original', before.width, before.height, 'exif', !!before.exif, 'xmp', !!before.xmp, 'icc', !!before.icc, 'iptc', !!before.iptc)
await sharp(src).rotate().resize(900, 1200).toColourspace('srgb').webp({ quality: 82, effort: 5 }).toFile('public/media/about/portrait.webp')
await sharp(src)
  .rotate()
  .resize(800, 1067)
  .extract({ left: 0, top: 0, width: 800, height: 1000 })
  .toColourspace('srgb')
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile('public/media/about/portrait-4x5.jpg')
for (const f of ['portrait.webp', 'portrait-4x5.jpg']) {
  const m = await sharp(`public/media/about/${f}`).metadata()
  console.log(f, m.width, m.height, 'exif', !!m.exif, 'xmp', !!m.xmp, 'icc', !!m.icc, 'iptc', !!m.iptc)
}
