// Share cards for og:image / twitter:image.
//   node scripts/build-share-cards.mjs               render the PNGs into .cache/share-cards (before `react-router build`, whose loaders read the hashes)
//   node scripts/build-share-cards.mjs --after-build copy them into build/client/_og, where worker/static.ts serves them at /<route>/opengraph-image
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
process.chdir(root)
if (process.argv.includes('--after-build')) {
  fs.cpSync(path.join('.cache', 'share-cards'), path.join('build', 'client', '_og'), { recursive: true, filter: (s) => !s.endsWith('manifest.json') })
  console.log('share cards copied to build/client/_og')
} else {
  execFileSync(path.join(root, '..', '..', 'node_modules', '.bin', 'vite-node'), ['--config', 'vite.node.config.mts', 'scripts/share-cards.ts'], { stdio: 'inherit' })
}
