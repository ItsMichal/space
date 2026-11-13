// After `react-router build`: the private pages' link table at build/client/_private/pages.json (docs/private-pages.md). The Worker
// reads it through its ASSETS binding and never serves /_private/ or /p/<key> (nor /p/<key>.data) itself, only /p/<token>.
// Prints how many pages and links, never which.
import fs from 'node:fs'
import path from 'node:path'
import { pagesManifest, readPages } from '../lib/pages/build.mjs'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'build', 'client')
const pages = readPages(root)
const manifest = pagesManifest(pages)
fs.mkdirSync(path.join(out, '_private'), { recursive: true })
fs.writeFileSync(path.join(out, '_private', 'pages.json'), `${JSON.stringify(manifest)}\n`)
const p = path.join(out, 'p')
for (const pg of pages) {
  if (!fs.existsSync(path.join(p, `${pg.key}.html`)) && !fs.existsSync(path.join(p, pg.key, 'index.html'))) {
    console.error('private pages: a page was not prerendered')
    process.exit(1)
  }
}
const n = Object.keys(manifest.links).length
console.log(`private pages: ${pages.length} page${pages.length === 1 ? '' : 's'}, ${n} open link${n === 1 ? '' : 's'}`)
