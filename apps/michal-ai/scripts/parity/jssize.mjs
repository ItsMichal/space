// JavaScript (and CSS) a route loads on first view, from the built HTML: <script src> + modulepreload (new) or <script src> (Next).
//   node scripts/parity/jssize.mjs <client-dir> <html-path>...   e.g. build/client / /writing/foo ; for Next: .next/static is resolved too
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const [dir, ...routes] = process.argv.slice(2)
const resolve = (u) => {
  const clean = u.split('?')[0]
  if (clean.startsWith('/_next/')) return path.join(dir, clean.replace('/_next/', ''))
  return path.join(dir, clean)
}
const size = (u) => {
  try {
    const b = fs.readFileSync(resolve(u))
    return { raw: b.length, gz: zlib.gzipSync(b).length }
  } catch {
    return { raw: 0, gz: 0 }
  }
}
const kb = (n) => (n / 1024).toFixed(1).padStart(7)
for (const r of routes) {
  const hd = process.env.HTMLDIR ?? dir
  const htmlFile = r === '/' ? path.join(hd, 'index.html') : path.join(hd, r, 'index.html')
  const html = fs.readFileSync(fs.existsSync(htmlFile) ? htmlFile : path.join(hd, r + '.html'), 'utf8')
  const js = new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]))
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) js.add(m[1])
  const css = new Set([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]))
  const sum = (set) => [...set].reduce((a, u) => ({ raw: a.raw + size(u).raw, gz: a.gz + size(u).gz }), { raw: 0, gz: 0 })
  if (process.env.LIST) for (const u of js) console.log(`    ${kb(size(u).raw)} ${kb(size(u).gz)}  ${u}`)
  const j = sum(js), c = sum(css)
  console.log(`${r.padEnd(46)} JS ${kb(j.raw)} kB raw ${kb(j.gz)} kB gzip (${js.size} files)   CSS ${kb(c.raw)} raw ${kb(c.gz)} gzip   HTML ${kb(Buffer.byteLength(html))} raw ${kb(zlib.gzipSync(html).length)} gzip`)
}
