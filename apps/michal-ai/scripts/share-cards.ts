// Renders every share card (og:image and twitter:image) to .cache/share-cards/ and writes a manifest of content hashes.
// Replaces the app/**/opengraph-image.tsx routes. Run through vite-node (scripts/build-share-cards.mjs) so lib/og.tsx works as is.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getAllPosts } from '@/lib/content'
import { postPath } from '@/lib/seo'
import { renderAboutOg, renderHomeOg, renderListOg, renderPostOg, renderResumeOg } from '@/lib/og'

const out = path.join(process.cwd(), '.cache', 'share-cards')
fs.rmSync(out, { recursive: true, force: true })

const cards: [string, () => { png(): Promise<Buffer> } | Promise<{ png(): Promise<Buffer> }>][] = [
  ['/', () => renderHomeOg()],
  ['/about', () => renderAboutOg()],
  ['/resume', () => renderResumeOg()],
  ['/projects', () => renderListOg('project', 'Selected work in AI, web and systems.')],
  ['/writing', () => renderListOg('article', 'Essays and notes on building with AI, the web and systems.')],
  ...getAllPosts().map((p): [string, () => { png(): Promise<Buffer> }] => [postPath(p), () => renderPostOg(p)]),
]

const manifest: Record<string, string> = {}
const hash = (b: Buffer, salt: string) => createHash('sha256').update(salt).update(b).digest('hex').slice(0, 16)
for (const [route, make] of cards) {
  const png = await (await make()).png()
  const base = route === '/' ? '' : route
  for (const kind of ['opengraph', 'twitter']) {
    const file = path.join(out, `${base}/${kind}-image.png`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, png)
    manifest[`${base}/${kind}-image`] = hash(png, kind)
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`share cards: ${cards.length} pages, ${cards.length * 2} images`)
