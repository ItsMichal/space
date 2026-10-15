// Shared helpers for the parity harness (see scripts/parity/README.md).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import * as parse5 from 'parse5'

export const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

export const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
export const slugFile = (p) => (p === '/' ? '_root' : p.replace(/^\//, '').replace(/[^a-zA-Z0-9._-]+/g, '__')) || '_root'

/** Bundler output names carry content hashes and differ by design (`/_next/static/...` vs `/assets/...`). */
export const isBuildAsset = (u) => /^\/(_next\/static|assets)\//.test(u)

/** Classify Cache-Control so Next's `s-maxage` and the asset binding's `max-age=0` compare as intent, not as bytes. */
export function cacheClass(cc = '') {
  if (!cc) return 'none'
  if (/immutable/.test(cc)) return 'immutable'
  if (/no-store/.test(cc)) return 'no-store'
  const m = /(?:s-maxage|max-age)=(\d+)/.exec(cc)
  const age = m ? Number(m[1]) : undefined
  if (age === 0 || /must-revalidate/.test(cc)) return 'revalidate'
  if (age !== undefined && age >= 31536000) return 'long'
  if (age !== undefined) return `max-age:${age}`
  return cc
}

const KEY_HEADERS = ['content-type', 'x-robots-tag', 'location', 'content-language', 'content-disposition']

export async function fetchOne(base, p, { method = 'GET', headers = {} } = {}) {
  const res = await fetch(base + p, { method, redirect: 'manual', headers: { 'accept-encoding': 'identity', ...headers } })
  const body = method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer())
  const h = {}
  for (const k of KEY_HEADERS) if (res.headers.has(k)) h[k] = res.headers.get(k)
  if (h.location) h.location = h.location.replace(/^https?:\/\/[^/]+/, '') // host differs between the two servers
  h['cache-class'] = cacheClass(res.headers.get('cache-control') ?? '')
  if (h['content-type']) h['content-type'] = h['content-type'].replace(/;\s*charset=utf-8/i, '').toLowerCase()
  return { status: res.status, headers: h, body }
}

// Minimal DOM helpers over parse5 (jsdom 30 needs a newer Node than the 22.3 some machines still run).
const walk = (n, fn) => {
  fn(n)
  for (const c of n.childNodes ?? []) walk(c, fn)
  if (n.content) walk(n.content, fn)
}
const all = (root, pred) => {
  const out = []
  walk(root, (n) => n.tagName && pred(n) && out.push(n))
  return out
}
const tag = (name) => (n) => n.tagName === name
const attr = (n, name) => n.attrs?.find((a) => a.name === name)?.value ?? null
const attrObj = (n, skip = []) => Object.fromEntries((n.attrs ?? []).filter((a) => !skip.includes(a.name)).map((a) => [a.name, a.value]).sort())
const rawText = (n) => {
  let s = ''
  walk(n, (x) => x.nodeName === '#text' && (s += x.value))
  return s
}
const text = (n) => (n ? rawText(n) : '').replace(/\s+/g, ' ').trim()

/** Everything the harness compares in an HTML document, as plain JSON. */
export function extractFacts(html, pagePath) {
  const doc = parse5.parse(html)
  const root = all(doc, tag('html'))[0]
  const head = all(doc, tag('head'))[0]
  const body = all(doc, tag('body'))[0]
  const norm = (u) => (u && isBuildAsset(u.replace(/^https?:\/\/[^/]+/, '')) ? `<build-asset>${u.slice(u.lastIndexOf('.'))}` : u)

  const metas = all(head, tag('meta'))
    .map((m) => attrObj(m))
    .filter((m) => m.name !== 'next-size-adjust')
    .map((m) => JSON.stringify(m))
    .sort()
  const links = all(head, tag('link'))
    .map((l) => {
      const a = attrObj(l, ['data-precedence', 'data-discover', 'nonce', 'crossorigin'])
      if (a.href) a.href = norm(a.href)
      return a
    })
    .filter((a) => !(a.rel === 'modulepreload' || a.rel === 'stylesheet' || (a.rel === 'preload' && a.as === 'script')))
    .map((a) => JSON.stringify(a))
    .sort()
  const stylesheets = all(head, (n) => n.tagName === 'link' && attr(n, 'rel') === 'stylesheet').length
  const ld = all(doc, (n) => n.tagName === 'script' && attr(n, 'type') === 'application/ld+json').map((s) => {
    try {
      return JSON.parse(rawText(s))
    } catch {
      return { __invalid: rawText(s) }
    }
  })
  const outline = all(doc, (n) => /^h[1-6]$/.test(n.tagName)).map((h) => `${h.tagName}:${text(h)}`)
  const anchorEls = all(doc, (n) => n.tagName === 'a' && attr(n, 'href') !== null)
  const anchors = anchorEls.map((a) => `${attr(a, 'href')} | ${text(a).slice(0, 80)}`)
  const imgEls = all(doc, tag('img'))
  const imgs = imgEls.map((i) => ({
    src: attr(i, 'src'),
    srcset: attr(i, 'srcset') ?? attr(i, 'srcSet'),
    alt: attr(i, 'alt'),
    width: attr(i, 'width'),
    height: attr(i, 'height'),
    loading: attr(i, 'loading'),
    fetchpriority: attr(i, 'fetchpriority') ?? attr(i, 'fetchPriority'),
  }))
  const sourceEls = all(doc, tag('source'))
  const sources = sourceEls.map((s) => `${attr(s, 'type')} | ${attr(s, 'srcset')} | ${attr(s, 'sizes')}`)
  const main = all(doc, tag('main'))[0]
  const scripts = all(doc, tag('script'))
  const internal = new Set()
  for (const a of anchorEls) internal.add(attr(a, 'href'))
  for (const i of imgs) {
    if (i.src) internal.add(i.src)
    for (const part of (i.srcset ?? '').split(',')) if (part.trim()) internal.add(part.trim().split(/\s+/)[0])
  }
  for (const s of sourceEls) for (const part of (attr(s, 'srcset') ?? '').split(',')) if (part.trim()) internal.add(part.trim().split(/\s+/)[0])
  for (const l of all(head, tag('link'))) if (['icon', 'apple-touch-icon', 'manifest', 'alternate'].includes(attr(l, 'rel'))) internal.add(attr(l, 'href'))
  for (const m of all(head, tag('meta'))) if (['og:image', 'twitter:image'].includes(attr(m, 'property') ?? attr(m, 'name'))) internal.add(attr(m, 'content').replace(/^https:\/\/michal\.ai/, '')) // served by the snapshot's own base

  return {
    path: pagePath,
    htmlAttrs: attrObj(root, ['class']),
    htmlClassCount: (attr(root, 'class') ?? '').split(/\s+/).filter(Boolean).length,
    bodyAttrs: attrObj(body, ['class']),
    bodyClass: attr(body, 'class'),
    title: text(all(head, tag('title'))[0]),
    metas,
    links,
    stylesheetCount: stylesheets,
    jsonLd: ld,
    outline,
    anchors,
    imgs,
    sources,
    mainText: text(main),
    inlineScripts: scripts.filter((s) => !attr(s, 'src') && attr(s, 'type') !== 'application/ld+json').length,
    scriptSrcCount: scripts.filter((s) => attr(s, 'src')).length,
    internalRefs: [...internal].filter((u) => u && !/^(https?:|mailto:|tel:|#|data:)/.test(u)).map((u) => u.replace(/#.*$/, '')),
  }
}

export const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
export const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n')
}
