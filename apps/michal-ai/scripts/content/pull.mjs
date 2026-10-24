#!/usr/bin/env node
// npm run content:pull: bring posts, post media and the layout file in from ItsMichal/space-content (private) and lay them out where
// the build reads them, content/posts/*.md, public/media/<slug>/* and content/layout.json. The site keeps reading those places; this script is the only way
// content gets there once the content repo is the source of truth (docs/content-repo.md).
//
// Source, in order:
//   --from <dir> or CONTENT_DIR=<dir>   an existing checkout (CI checks it out with a read-only deploy key and passes its path)
//   otherwise apps/michal-ai/.content   cloned or fast-forwarded to origin/main with your own git credentials
//                                       (CONTENT_REPO overrides the clone URL, default git@github.com:ItsMichal/space-content.git)
// The checkout is validated first (scripts/content/validate.mjs). Nothing is copied unless it passes.
// Site media (public/media/about, CREDITS.md, the generated _v and _og) is never touched.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const app = path.resolve(import.meta.dirname, '..', '..')
const KEEP_MEDIA = new Set(['about', '_v', '_og', 'CREDITS.md'])
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })

let src = arg('--from') ?? process.env.CONTENT_DIR
if (src) {
  src = path.resolve(src)
} else {
  src = path.join(app, '.content')
  const url = process.env.CONTENT_REPO || 'git@github.com:ItsMichal/space-content.git'
  if (!fs.existsSync(path.join(src, '.git'))) {
    console.log(`content: cloning ${url} into .content`)
    run('git', ['clone', '--depth', '1', '--branch', 'main', url, src])
  } else {
    console.log('content: updating .content to origin/main')
    run('git', ['-C', src, 'fetch', '--depth', '1', 'origin', 'main'])
    run('git', ['-C', src, 'checkout', '--detach', '--force', 'FETCH_HEAD'])
  }
}

const posts = path.join(src, 'posts')
const media = path.join(src, 'media')
const layout = path.join(src, 'site', 'layout.json')
if (!fs.existsSync(posts)) {
  console.error(`content: ${src} has no posts/ folder. Is it a checkout of ItsMichal/space-content?`)
  process.exit(1)
}

run(process.execPath, [path.join(app, 'scripts', 'content', 'validate.mjs'), '--posts', posts, '--media', media, '--layout', layout], { cwd: app })

// Posts: the folder becomes exactly the content repo's posts.
const outPosts = path.join(app, 'content', 'posts')
fs.mkdirSync(outPosts, { recursive: true })
for (const f of fs.readdirSync(outPosts)) if (f.endsWith('.md')) fs.rmSync(path.join(outPosts, f))
let n = 0
for (const f of fs.readdirSync(posts)) {
  if (!f.endsWith('.md')) continue
  // Regular files only: a symlink in the content repo could otherwise copy any file on the build machine into the site.
  if (!fs.lstatSync(path.join(posts, f)).isFile()) {
    console.error(`content: posts/${f} is not a regular file`)
    process.exit(1)
  }
  fs.copyFileSync(path.join(posts, f), path.join(outPosts, f))
  n++
}

// Media: every post folder is replaced by the content repo's copy; site folders stay.
const outMedia = path.join(app, 'public', 'media')
fs.mkdirSync(outMedia, { recursive: true })
for (const d of fs.readdirSync(outMedia)) if (!KEEP_MEDIA.has(d)) fs.rmSync(path.join(outMedia, d), { recursive: true, force: true })
let m = 0
if (fs.existsSync(media)) {
  for (const d of fs.readdirSync(media, { withFileTypes: true })) {
    if (!d.isDirectory() || KEEP_MEDIA.has(d.name) || d.name.startsWith('.')) continue
    fs.mkdirSync(path.join(outMedia, d.name), { recursive: true })
    for (const f of fs.readdirSync(path.join(media, d.name), { withFileTypes: true })) {
      if (!f.isFile() || f.name.startsWith('.')) continue
      fs.copyFileSync(path.join(media, d.name, f.name), path.join(outMedia, d.name, f.name))
      m++
    }
  }
}
// Layout: the content repo's site/layout.json, or the default order when it has none.
const outLayout = path.join(app, 'content', 'layout.json')
if (fs.existsSync(layout)) {
  if (!fs.lstatSync(layout).isFile()) {
    console.error('content: site/layout.json is not a regular file')
    process.exit(1)
  }
  fs.copyFileSync(layout, outLayout)
} else fs.writeFileSync(outLayout, '{ "version": 1 }\n')

const sha = (() => {
  try {
    return execFileSync('git', ['-C', src, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
})()
console.log(`content: ${n} posts, ${m} media files and ${fs.existsSync(layout) ? 'the layout file' : 'the default layout'} from space-content ${sha}`)
