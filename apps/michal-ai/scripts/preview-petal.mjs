// Dev helper: composite the petal on paper for eyeballing. Usage: node scripts/preview-petal.mjs <out.png>
import sharp from 'sharp'
// Paths below are relative to the app root; make that true whatever directory the script is launched from.
process.chdir(new URL('..', import.meta.url).pathname)

await sharp({ create: { width: 480, height: 600, channels: 3, background: '#f4f1e8' } })
  .composite([{ input: 'public/motion/petal.png', gravity: 'center' }])
  .png()
  .toFile(process.argv[2])
