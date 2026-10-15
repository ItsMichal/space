import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PAIRS, michalLinkFor, halmicLinkFor, michalPathFor, pairForHalmicPath, pairForPost } from './index.mjs'
import { readMichalPosts } from './node.mjs'
import { buildRedirects, readPostPaths, readRedirectMap } from '../../../apps/michal-ai/lib/redirects.mjs'

const repo = path.resolve(import.meta.dirname, '..', '..', '..')
const posts = readMichalPosts(repo)
const michalRoot = path.join(repo, 'apps', 'michal-ai')
const halmicRoot = path.join(repo, 'apps', 'halmic')
const denylist = fs
  .readFileSync(path.join(repo, 'scripts', 'identity-denylist.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => new RegExp(l, 'i'))

const frontTitle = (file) => fs.readFileSync(file, 'utf8').match(/^title:\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '')

// what the Halmic build publishes, read from its content (build.mjs derives every route from the same files)
const mtDir = path.join(halmicRoot, 'content', 'mountaintop')
const mtIndex = JSON.parse(fs.readFileSync(path.join(mtDir, 'index.json'), 'utf8'))
const halmicRoutes = new Map([
  ['/work/project-mountaintop/', mtIndex.title],
  ...mtIndex.logs.map((l) => [`/work/project-mountaintop/${l.slug}/`, frontTitle(path.join(mtDir, `${l.slug}.md`))]),
])
const games = JSON.parse(fs.readFileSync(path.join(halmicRoot, 'content', 'games.json'), 'utf8')).games
const cur = JSON.parse(fs.readFileSync(path.join(halmicRoot, 'content', 'curation.json'), 'utf8')).games
for (const g of games) if ((cur[g.slug]?.tier ?? 'more') !== 'off') halmicRoutes.set(`/games/${g.slug}/`, g.title.replace(/ \(.*\)$/, ''))

test('the map has no duplicates', () => {
  assert.equal(new Set(PAIRS.map((p) => p.post)).size, PAIRS.length)
  assert.equal(new Set(PAIRS.map((p) => p.halmic)).size, PAIRS.length)
})

test('every michal.ai target is a live, non-redirecting route, resolved from the stable id', () => {
  const map = readRedirectMap(michalRoot)
  const live = new Set(readPostPaths(michalRoot).map((p) => p.path))
  const sources = new Set(buildRedirects(map, readPostPaths(michalRoot)).map((r) => r.source))
  for (const p of PAIRS) {
    const route = michalPathFor(p.post, posts)
    assert.ok(route, `no michal.ai post has id ${p.post}`)
    assert.ok(live.has(route), `${route} is not a live route`)
    assert.ok(!sources.has(route), `${route} is a redirect source`)
    assert.ok(michalLinkFor(p.halmic, posts).href.endsWith(route))
  }
})

test('every Halmic target exists and its title is the one Halmic prints', () => {
  for (const p of PAIRS) {
    assert.ok(halmicRoutes.has(p.halmic), `Halmic has no page at ${p.halmic}`)
    assert.equal(halmicRoutes.get(p.halmic), p.halmicTitle, `title for ${p.halmic}`)
  }
})

test('if the Halmic site is built, every target page is in the output', () => {
  for (const p of PAIRS) {
    const file = path.join(halmicRoot, 'public', p.halmic, 'index.html')
    if (fs.existsSync(path.join(halmicRoot, 'public', 'index.html'))) assert.ok(fs.existsSync(file), `${file} missing from the build output`)
  }
})

test('michalTitle is the real post title, or null; a title Halmic prints never trips the identity denylist', () => {
  for (const p of PAIRS) {
    const post = posts.find((x) => x.id === p.post)
    if (p.michalTitle === null) continue
    assert.equal(p.michalTitle, post.title)
    for (const re of denylist) assert.ok(!re.test(p.michalTitle), `${p.michalTitle} matches ${re}`)
  }
})

test('lookups', () => {
  assert.equal(pairForPost('project-mountaintop').halmic, '/work/project-mountaintop/')
  assert.equal(pairForHalmicPath('/games/taco-neko').post, 'taco-neko-development')
  assert.equal(halmicLinkFor('hello-paper'), undefined)
  assert.equal(michalLinkFor('/videos/', posts), undefined)
  assert.equal(michalLinkFor('/work/project-mountaintop/', posts).href, 'https://michal.ai/projects/project-mountaintop')
})

test('a rename does not break the link: the path follows the post, the id stays', () => {
  const renamed = posts.map((p) => (p.id === 'taco-neko-development' ? { ...p, slug: 'taco-neko-dev-log' } : p))
  assert.equal(michalLinkFor('/games/taco-neko/', renamed).href, 'https://michal.ai/writing/taco-neko-dev-log')
})
