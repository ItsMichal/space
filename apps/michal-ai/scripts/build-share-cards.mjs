// Share cards for og:image / twitter:image.
//   node scripts/build-share-cards.mjs               render the PNGs into .cache/share-cards (before `react-router build`, whose loaders read the hashes)
//   node scripts/build-share-cards.mjs --after-build copy them into build/client/_og, where worker/static.ts serves them at /<route>/opengraph-image,
//                                                    and drop build leftovers the Worker never serves
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
process.chdir(root)
if (process.argv.includes('--after-build')) {
  fs.cpSync(path.join('.cache', 'share-cards'), path.join('build', 'client', '_og'), { recursive: true, filter: (s) => !s.endsWith('manifest.json') })
  console.log('share cards copied to build/client/_og')
  // Leftovers the Worker never serves: the SPA fallback (unknown URLs get the prerendered 404 page instead) and the loader-data
  // files of resource routes (feeds, sitemap, robots, manifest are fetched as themselves, never through client navigation).
  const out = path.join('build', 'client')
  fs.rmSync(path.join(out, '__spa-fallback.html'), { force: true })
  for (const f of fs.readdirSync(out, { recursive: true })) {
    if (/\.(xml|json|txt|webmanifest)\.data$/.test(String(f))) fs.rmSync(path.join(out, String(f)))
  }
} else {
  execFileSync(path.join(root, '..', '..', 'node_modules', '.bin', 'vite-node'), ['--config', 'vite.node.config.mts', 'scripts/share-cards.ts'], { stdio: 'inherit' })
}
