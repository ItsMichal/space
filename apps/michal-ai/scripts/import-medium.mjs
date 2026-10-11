#!/usr/bin/env node
/**
 * Re-runnable importer: the owner's Medium articles -> content/posts/<slug>.md + public/media/<slug>/*
 *
 * Usage:
 *   node scripts/import-medium.mjs                  # import everything
 *   node scripts/import-medium.mjs --only <slug|id> # one article (slug, 12-char Medium id, or Medium URL fragment)
 *   node scripts/import-medium.mjs --force          # re-download images even when already present
 *   node scripts/import-medium.mjs --no-images      # convert text only (image links still point at /media/..)
 *   node scripts/import-medium.mjs --refresh-feed   # re-download scripts/medium-src/feed.xml from the RSS feed
 *
 * Sources (all committed, so the import is deterministic and works offline apart from images):
 *   scripts/medium-src/feed.xml      RSS snapshot of https://halmic.medium.com/feed (latest ~10 articles, full HTML)
 *   scripts/medium-src/meta.json     per-article metadata for the feed items (dates, tags, section breaks, ...)
 *   scripts/medium-src/<id>.html     articles the feed does not carry. Medium's article pages sit behind Cloudflare
 *                                    (403 for curl), so these were serialised from the page's own article model in a
 *                                    browser. First line is `<!--meta {...} -->`, then simplified HTML.
 *   MEDIA_EMBEDS below               gist embeds: Medium serves them from medium.com/media/<id> (also blocked for curl),
 *                                    so the gist URLs were looked up once and are recorded here.
 *
 * Output: every post is `kind: article`, `draft: true`, `canonical:` the original Medium URL. Re-running overwrites
 * content/posts/<slug>.md, so hand edits after the import are lost; run with --only for a single article.
 * Also writes docs/content-review/medium-import.json (machine-readable per-article log).
 *
 * Text is never rewritten: only the HTML -> Markdown translation, link cleaning, and metadata derivation happen here.
 * Extra dependency: hast-util-from-html (HTML parser). Images: curl + sharp.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { fromHtml } from 'hast-util-from-html'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import { toString as mdToString } from 'mdast-util-to-string'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const POSTS_DIR = path.join(ROOT, 'content', 'posts')
const MEDIA_DIR = path.join(ROOT, 'public', 'media')
const SRC_DIR = path.join(ROOT, 'scripts', 'medium-src')
const LOG_FILE = path.join(ROOT, 'docs', 'content-review', 'medium-import.json')
const FEED_URL = 'https://halmic.medium.com/feed'

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const NO_IMAGES = args.includes('--no-images')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

/** Medium "gist" embeds: medium.com/media/<id> -> where the code really lives. */
const MEDIA_EMBEDS = {
  bd9bf93cd0a6bb9de0d19c9162fbd086: { title: 'Lane Defense - Serial Arduino Nano Game', url: 'https://gist.github.com/ItsMichal/a186eaf2f3f17f2ada46b8f19fec2e16' },
  '2f532093b9c883876117c33b4d37f215': { title: 'Prototype Boxing Bag Code', url: 'https://gist.github.com/ItsMichal/b28838b117930354e6e7a5ffd1b3e8fc' },
  b95e7d835070b566dc0a0d3000f2f5a3: { title: 'MEDPuck - Medicine Timer - .ino, Gerber, and Schematic', url: 'https://gist.github.com/ItsMichal/d6447a63577c7a86f83c25ce52554f1f' },
  '4c364200cfc0a6a32bced1548d785089': { title: 'Police LEDs Arduino Nano 33 IoT', url: 'https://gist.github.com/ItsMichal/83bbf5e1ecba49d85802d44381818a4b' },
  '15ffa13d0b2001db3cfd6b2337b8676a': { title: 'LED Pong', url: 'https://gist.github.com/ItsMichal/73bbc6190475ab6cd8c3e219c2e4cb9f' },
}
/** Titles the author gave his YouTube embeds on Medium (used as the iframe title for accessibility). */
const YOUTUBE_TITLES = {
  rvVoF5p_hXM: 'Police LED Interaction',
  kQ4YILcm0zQ: 'Protoboard LED Demo',
  yHjq8IRvXc4: 'First Stage LED Pong',
  HWMPAJ3ZoaI: 'Final stage LED Pong',
  hdnndI1rcKc: 'Lane Defense - Punching Bag Demo',
  '84n9oLqIYtQ': 'MedPuck Prototype Enclosure and PCB',
  yNP8Ox28alI: 'MedPuck Prototype',
  'cVro2o0g-ls': 'Enclosure Animation v1 and v2',
  HE_1ACRD4qw: 'Michal Stinger',
}
/** Medium tag -> the site's existing tag vocabulary (and a few obvious spelling fixes). */
const TAG_MAP = {
  'game development': 'Game Dev',
  gbstudio: 'GB Studio',
  itchio: 'itch.io',
  attiny85: 'ATtiny85',
  diy: 'DIY',
}

/* ------------------------------------------------------------------ helpers */
const yamlStr = (s) => JSON.stringify(s)
const slugify = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10) // UTC day, same as Medium's own article:published_time
const ws = (s) => s.replace(/\s+/g, ' ').trim()
const flat = (s) => s.replace(/\s+/g, '')

function curlText(url) {
  return execFileSync('curl', ['-sSL', '--fail', '--retry', '2', '-A', 'Mozilla/5.0', url], { maxBuffer: 1 << 26 }).toString('utf8')
}
function curlFile(url, dest) {
  execFileSync('curl', ['-sSL', '--fail', '--retry', '2', '-A', 'Mozilla/5.0', '-o', dest, url], { maxBuffer: 1 << 24 })
}

/* ------------------------------------------------------------------ load sources */
function loadSources() {
  if (args.includes('--refresh-feed')) {
    fs.writeFileSync(path.join(SRC_DIR, 'feed.xml'), curlText(FEED_URL))
    console.log('refreshed feed.xml (note: meta.json must be extended by hand for any new article)')
  }
  const meta = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'meta.json'), 'utf8'))
  const out = []
  const feed = fs.readFileSync(path.join(SRC_DIR, 'feed.xml'), 'utf8')
  for (const item of feed.split('<item>').slice(1)) {
    const id = /<guid[^>]*>https:\/\/medium\.com\/p\/([0-9a-f]+)</.exec(item)?.[1]
    const html = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/.exec(item)?.[1]
    if (!id || html == null) continue
    if (!meta[id]) throw new Error(`feed item ${id} has no entry in meta.json`)
    out.push({ id, source: 'feed', html, ...meta[id] })
  }
  for (const f of fs.readdirSync(SRC_DIR).filter((f) => /^[0-9a-f]{12}\.html$/.test(f))) {
    const raw = fs.readFileSync(path.join(SRC_DIR, f), 'utf8')
    const m = /^<!--meta (\{.*\}) -->\n/.exec(raw)
    if (!m) throw new Error(`${f}: missing meta header`)
    out.push({ ...JSON.parse(m[1]), source: 'browser', html: raw.slice(m[0].length) })
  }
  return out.sort((a, b) => a.first - b.first)
}

/* ------------------------------------------------------------------ slugs & link rewriting */
function assignSlugs(articles) {
  const taken = new Map() // slug -> canonical url ('' = foreign file)
  for (const f of fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8')
    const canon = /^canonical:\s*"?([^"\n]+)"?\s*$/m.exec(raw)?.[1] ?? ''
    taken.set(f.replace(/\.md$/, ''), canon)
  }
  const used = new Set()
  for (const a of articles) {
    let slug = slugify(a.title)
    const mine = (s) => taken.get(s) === a.url
    if (!mine(slug) && (taken.has(slug) || used.has(slug))) slug = `${slug.slice(0, 55)}-medium`
    a.slug = slug
    used.add(slug)
  }
}

let SLUG_BY_ID = new Map()
function cleanHref(raw) {
  let href = raw.trim()
  if (!href) return ''
  try {
    let u = new URL(href)
    // medium.com redirect wrappers
    if (u.hostname.endsWith('medium.com') && u.pathname.startsWith('/r/') && u.searchParams.get('url')) u = new URL(u.searchParams.get('url'))
    // the author's own other articles -> local routes
    const own = /(?:^|[-/])([0-9a-f]{12})$/.exec(u.pathname)
    if (own && (u.hostname === 'halmic.medium.com' || (u.hostname === 'medium.com' && /^\/(@halmic|p)\//.test(u.pathname))) && SLUG_BY_ID.has(own[1])) {
      return `/writing/${SLUG_BY_ID.get(own[1])}`
    }
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|source$|sk$|ref$|fbclid$|gclid$|mc_)/i.test(k)) u.searchParams.delete(k)
    }
    if (u.hostname.endsWith('medium.com')) u.hash = ''
    href = u.toString()
    // `new URL` adds a trailing slash to bare origins; keep what the author typed
    if (!/^https?:\/\/[^/]+\/$/.test(raw.trim()) && /^https?:\/\/[^/]+\/$/.test(href)) href = href.slice(0, -1)
    return href.replace(/\?$/, '')
  } catch {
    return href
  }
}
const mdHref = (h) => (/[\s()<>]/.test(h) ? h.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/</g, '%3C').replace(/>/g, '%3E') : h)

/* ------------------------------------------------------------------ hast -> markdown */
const D = { B: '', I: '', C: '' } // placeholder delimiters, resolved after escaping
const textOf = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(textOf).join(''))

function escapeText(t) {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '\\<')
    .replace(/~/g, '\\~')
    .replace(/(^|[^\p{L}\p{N}])_/gu, '$1\\_')
    .replace(/_(?![\p{L}\p{N}])/gu, '\\_')
    .replace(/&(#?\w+;)/g, '\\&$1')
    .replace(/(^|[^\p{L}\p{N}]):(?=[A-Za-z:])/gu, '$1\\:')
}
function escapeLineStarts(s) {
  return s
    .split('\n')
    .map((l) =>
      l
        .replace(/^(\s*)(#{1,6})(\s|$)/, '$1\\$2$3')
        .replace(/^(\s*)([-+])(\s|$)/, '$1\\$2$3')
        .replace(/^(\s*)(\d+)([.)])(\s|$)/, '$1$2\\$3$4')
        .replace(/^(\s*)>/, '$1\\>')
        .replace(/^(\s*)(=+|-{2,}|_{3,})\s*$/, '$1\\$2')
    )
    .join('\n')
}
function wrapMark(inner, d) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)
  return m[2] ? `${m[1]}${d}${m[2]}${d}${m[3]}` : inner
}
function inline(nodes, ctx, opts = {}) {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') out += escapeText(n.value)
    else if (n.type === 'element') {
      const inner = () => inline(n.children, ctx, opts)
      switch (n.tagName) {
        case 'strong':
        case 'b':
          out += opts.noMarks ? inner() : wrapMark(inner(), D.B)
          break
        case 'em':
        case 'i':
          out += opts.noMarks ? inner() : wrapMark(inner(), D.I)
          break
        case 'code': {
          const t = textOf(n)
          const fence = t.includes('`') ? '``' : '`'
          out += t ? `${fence}${t}${fence}` : ''
          break
        }
        case 'br':
          out += '\\\n'
          break
        case 'a': {
          const href = cleanHref(String(n.properties?.href ?? ''))
          const body = inner()
          if (!href || opts.noLinks) out += body
          else if (/^\s*$/.test(body)) out += ''
          else out += `[${body}](${mdHref(href)})`
          break
        }
        case 'img':
          break
        default:
          out += inner()
      }
    }
  }
  return out
}
function resolveMarks(s) {
  // merge adjacent same-mark spans (`**a** **b**` stays; `**a****b**` collapses)
  for (const d of [D.B, D.I]) s = s.split(d + d).join('')
  return s.split(D.B).join('**').split(D.I).join('*')
}
const para = (nodes, ctx, opts) => escapeLineStarts(resolveMarks(inline(nodes, ctx, opts))).replace(/[ \t]+\n/g, '\n').trim()

function youtubeIdFromUrl(u) {
  try {
    const x = new URL(u)
    if (x.hostname === 'youtu.be') return x.pathname.slice(1)
    if (/(^|\.)youtube\.com$/.test(x.hostname)) {
      if (x.searchParams.get('v')) return x.searchParams.get('v')
      const m = /\/(?:embed|shorts|live)\/([\w-]+)/.exec(x.pathname)
      if (m) return m[1]
    }
  } catch {}
  return null
}
function iframeInfo(n) {
  const src = String(n.properties?.src ?? '')
  const inner = textOf(n)
  const out = { title: String(n.properties?.dataTitle ?? '') }
  if (src) {
    try {
      const u = new URL(src)
      const target = u.hostname === 'cdn.embedly.com' ? u.searchParams.get('url') || u.searchParams.get('src') : src
      const yt = target && youtubeIdFromUrl(target)
      if (yt) return { ...out, kind: 'youtube', id: yt }
      if (target) return { ...out, kind: 'link', url: target }
    } catch {}
  }
  const mid = /medium\.com\/media\/([0-9a-f]{32})/.exec(inner)?.[1]
  if (mid) return { ...out, kind: 'media', id: mid }
  return { ...out, kind: 'unknown' }
}
const ytDirective = (id) => `::youtube{id="${id}"${YOUTUBE_TITLES[id] ? ` title="${YOUTUBE_TITLES[id].replace(/"/g, "'")}"` : ''}}`

/** Convert one article's body (hast element list) to markdown blocks. */
async function convertBody(article, ctx) {
  const tree = fromHtml(article.html, { fragment: true })
  let nodes = tree.children.filter((n) => n.type === 'element')
  nodes = nodes.filter((n) => !(n.tagName === 'img' && /stat\?event/.test(String(n.properties?.src ?? ''))))
  const breaks = new Set(article.breaksBefore ?? [])

  // lead image: a figure before the title heading (Medium's "cover"), or flagged in meta for feed items whose title is stripped
  let cover = null
  const titleIdx = nodes.findIndex((n) => /^h[1-4]$/.test(n.tagName) && ws(textOf(n)) === ws(article.title))
  const lead = titleIdx > 0 ? nodes.slice(0, titleIdx).find((n) => n.tagName === 'figure') : article.leadImage ? nodes.find((n) => n.tagName === 'figure') : null
  // The site requires real alt text on covers (lib/content/__tests__/content.test.ts). Medium supplies none for these
  // images, so a lead image only becomes the cover when it has alt text; otherwise it stays as the first image of the body.
  if (lead && ws(String(findEl(lead, 'img')?.properties?.alt ?? ''))) cover = lead
  else if (lead) ctx.notes.push('lead image kept in the body: no alt text from Medium, so it cannot be a cover yet')
  if (titleIdx >= 0) nodes.splice(titleIdx, 1)

  const blocks = []
  const checks = [] // {md, expected} for the text round-trip check
  let idx = 0
  for (const n of nodes) {
    const here = idx++
    if (n === cover) continue
    if (n.tagName === 'hr') {
      blocks.push('---')
      idx--
      continue
    }
    if (breaks.has(here)) blocks.push('---')
    await convertBlock(n, article, ctx, blocks, checks)
  }
  return { blocks, checks, cover }
}

async function convertBlock(n, article, ctx, blocks, checks) {
  const t = n.tagName
  if (/^h[1-6]$/.test(t)) {
    const level = Math.min(6, Math.max(2, Number(t[1]) - 1)) // Medium h3 -> ##, h4 -> ###
    const md = para(n.children, ctx, { noMarks: true })
    if (md) {
      blocks.push(`${'#'.repeat(level)} ${md}`)
      checks.push({ md: blocks.at(-1), expected: textOf(n) })
    }
  } else if (t === 'p') {
    const kids = n.children.filter((c) => !(c.type === 'text' && !c.value.trim()))
    const only = kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'a' ? kids[0] : null
    if (only) {
      const href = String(only.properties?.href ?? '')
      const yt = youtubeIdFromUrl(href)
      if (yt && ws(textOf(only)).replace(/^https?:\/\//, '') === href.replace(/^https?:\/\//, '')) {
        ctx.embeds.push(`youtube ${yt} (from a bare link)`)
        blocks.push(ytDirective(yt)) // a bare YouTube link paragraph was an embed in the author's intent
        return
      }
      const lines = textOf(only).split('\n').map((s) => s.trim()).filter(Boolean)
      if (lines.length > 1) {
        // Medium link card: "Title\nDescription…host" -> keep the title as the link text
        const h = cleanHref(href)
        blocks.push(`[${escapeText(lines[0])}](${mdHref(h)})`)
        ctx.notes.push(`link card "${lines[0]}" reduced to a plain link`)
        return
      }
    }
    const md = para(n.children, ctx)
    if (md) {
      blocks.push(md)
      checks.push({ md, expected: textOf(n) })
    }
  } else if (t === 'ul' || t === 'ol') {
    const items = n.children.filter((c) => c.type === 'element' && c.tagName === 'li')
    const lines = items.map((li, i) => `${t === 'ul' ? '-' : `${i + 1}.`} ${para(li.children, ctx).replace(/\n/g, '\n  ')}`)
    blocks.push(lines.join('\n'))
    items.forEach((li, i) => checks.push({ md: lines[i], expected: textOf(li) }))
  } else if (t === 'blockquote') {
    const md = para(n.children, ctx)
    blocks.push(md.split('\n').map((l) => `> ${l}`).join('\n'))
    checks.push({ md: blocks.at(-1), expected: textOf(n) })
    if (n.properties?.dataPull !== undefined) ctx.notes.push('pull quote converted to a blockquote')
  } else if (t === 'pre') {
    const code = textOf(n).replace(/\n$/, '')
    const lang = String(n.properties?.dataLang ?? '')
    blocks.push('```' + lang + '\n' + code + '\n```')
  } else if (t === 'figure') {
    const img = findEl(n, 'img')
    if (!img) return
    const cap = findEl(n, 'figcaption')
    const rec = await addImage(article, ctx, String(img.properties.src), String(img.properties.alt ?? ''))
    if (rec) {
      const title = cap ? ws(textOf(cap)).replace(/\\/g, '\\\\').replace(/"/g, '\\"') : ''
      blocks.push(`![${rec.alt.replace(/[\[\]]/g, '')}](${rec.local}${title ? ` "${title}"` : ''})`)
      if (cap) ctx.captions++
    }
  } else if (t === 'iframe') {
    const info = iframeInfo(n)
    if (info.kind === 'youtube') {
      if (info.title && !YOUTUBE_TITLES[info.id]) YOUTUBE_TITLES[info.id] = info.title
      blocks.push(ytDirective(info.id))
      ctx.embeds.push(`youtube ${info.id}`)
    } else if (info.kind === 'media' && MEDIA_EMBEDS[info.id]) {
      const g = MEDIA_EMBEDS[info.id]
      blocks.push(`[${escapeText(g.title)}](${g.url})`)
      ctx.embeds.push(`gist -> link: ${g.url}`)
    } else if (info.kind === 'link') {
      blocks.push(`[${info.title || info.url}](${mdHref(info.url)})`)
      ctx.embeds.push(`embed -> link: ${info.url}`)
    } else {
      ctx.unresolved.push(`embed ${info.id ?? ''} ${info.title} could not be resolved`)
    }
  } else if (['div', 'section', 'figcaption'].includes(t)) {
    for (const c of n.children.filter((c) => c.type === 'element')) await convertBlock(c, article, ctx, blocks, checks)
  } else {
    ctx.unresolved.push(`unsupported element <${t}> skipped`)
  }
}
function findEl(n, tag) {
  for (const c of n.children ?? []) {
    if (c.type !== 'element') continue
    if (c.tagName === tag) return c
    const f = findEl(c, tag)
    if (f) return f
  }
  return null
}

/* ------------------------------------------------------------------ images */
function mediumImageId(src) {
  // feed: .../max/1024/1*ID.png ; browser snapshot: bare "1*ID.png" or "0*ID"
  const m = /(?:^|\/)(\d\*[\w-]+(?:\.\w+)?)$/.exec(src.split('?')[0])
  return m ? m[1] : null
}
async function addImage(article, ctx, src, alt) {
  const id = mediumImageId(src)
  if (!id) {
    ctx.unresolved.push(`image with unrecognised source ${src.slice(0, 80)}`)
    return null
  }
  let rec = ctx.images.get(id)
  if (!rec) {
    const n = ctx.images.size + 1
    const stem = `${String(n).padStart(2, '0')}-${crypto.createHash('sha1').update(id).digest('hex').slice(0, 6)}`
    rec = { id, stem, alt: ws(alt), local: null, n }
    ctx.images.set(id, rec)
    rec.local = NO_IMAGES ? `/media/${article.slug}/${stem}.webp` : await saveImage(article.slug, id, stem, ctx)
    if (!rec.local) {
      ctx.images.delete(id)
      return null
    }
  }
  if (!rec.alt) ctx.missingAlt.push(rec.local)
  return rec
}
async function saveImage(slug, id, stem, ctx) {
  const dir = path.join(MEDIA_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })
  const existing = fs.readdirSync(dir).find((f) => f.slice(0, f.lastIndexOf('.')) === stem)
  if (existing && !FORCE) return `/media/${slug}/${existing}`
  const tmp = path.join(dir, `.${stem}.tmp`)
  try {
    curlFile(`https://miro.medium.com/v2/${id}`, tmp) // no resize segment = the original upload
  } catch (e) {
    fs.rmSync(tmp, { force: true })
    ctx.unresolved.push(`image ${id} failed to download: ${String(e.message).split('\n')[0]}`)
    return null
  }
  const buf = fs.readFileSync(tmp)
  fs.rmSync(tmp)
  let out = buf
  let ext = '.bin'
  try {
    const meta = await sharp(buf, { animated: true }).metadata()
    ext = '.' + (meta.format === 'jpeg' ? 'jpg' : meta.format)
    if (buf.length > 400 * 1024 || (meta.width ?? 0) > 2000) {
      out = await sharp(buf, { animated: true }).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      ext = '.webp'
    }
  } catch (e) {
    ctx.unresolved.push(`image ${id}: could not process (${e.message})`)
  }
  for (const f of fs.readdirSync(dir)) if (f.slice(0, f.lastIndexOf('.')) === stem) fs.rmSync(path.join(dir, f))
  const file = `${stem}${ext}`
  fs.writeFileSync(path.join(dir, file), out)
  return `/media/${slug}/${file}`
}

/* ------------------------------------------------------------------ metadata */
function normaliseTags(tags) {
  const seen = new Set()
  const out = []
  for (const t of tags) {
    const v = TAG_MAP[t.toLowerCase()] ?? t
    if (!seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase())
      out.push(v)
    }
  }
  return out
}
function describe(blocks) {
  const first = blocks.find((b) => !/^(#|>|:|!\[|---|-\s|\d+\.\s|```|\[[^\]]*\]\([^)]*\)$)/.test(b))
  if (!first) return ''
  const t = first
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\([\\`*_{}\[\]()#+\-.!<>~:&|])/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= 158) return t
  const sentence = /^(.{20,200}?[.!?])(\s|$)/.exec(t)
  if (sentence && sentence[1].length <= 200) return sentence[1]
  const cut = t.slice(0, 158)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…'
}

/* ------------------------------------------------------------------ text round-trip check */
const md2 = unified().use(remarkParse).use(remarkGfm).use(remarkDirective)
function verify(checks, ctx) {
  for (const { md, expected } of checks) {
    let body = md
    // strip structural prefixes so only text remains
    const tree = md2.parse(md)
    let got = mdToString(tree)
    if (flat(got) !== flat(expected)) {
      ctx.warnings.push(`text mismatch in block "${body.slice(0, 50).replace(/\n/g, ' ')}": expected ${JSON.stringify(ws(expected).slice(0, 80))} got ${JSON.stringify(ws(got).slice(0, 80))}`)
    }
  }
}

/* ------------------------------------------------------------------ main */
async function main() {
  const articles = loadSources()
  assignSlugs(articles)
  SLUG_BY_ID = new Map(articles.map((a) => [a.id, a.slug]))
  fs.mkdirSync(POSTS_DIR, { recursive: true })
  const log = []

  for (const a of articles) {
    if (ONLY && ![a.slug, a.id].includes(ONLY) && !a.url.includes(ONLY)) continue
    console.log(`\n${a.slug}  (${a.id}, ${a.source})`)
    const ctx = { notes: [], embeds: [], unresolved: [], warnings: [], missingAlt: [], images: new Map(), captions: 0 }
    const { blocks, checks, cover } = await convertBody(a, ctx)

    let coverPath
    let coverAlt = ''
    if (cover) {
      const img = findEl(cover, 'img')
      const rec = await addImage(a, ctx, String(img.properties.src), String(img.properties.alt ?? ''))
      if (rec) {
        coverPath = rec.local
        coverAlt = rec.alt
        if (!rec.alt) ctx.missingAlt = ctx.missingAlt.filter((x, i, arr) => !(x === rec.local && arr.lastIndexOf(x) === i))
      }
    }
    verify(checks, ctx)

    const body = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
    const description = a.subtitle || describe(blocks) || a.title
    const date = isoDay(a.first)
    const updated = isoDay(a.latest) !== date ? isoDay(a.latest) : null
    const tags = normaliseTags(a.tags)
    const fm = [
      '---',
      `title: ${yamlStr(a.title)}`,
      `slug: ${a.slug}`,
      'kind: article',
      `description: ${yamlStr(description)}`,
      `date: ${date}`,
      ...(updated ? [`updated: ${updated}`] : []),
      `tags: [${tags.map(yamlStr).join(', ')}]`,
      ...(coverPath ? [`cover: ${coverPath}`, ...(coverAlt ? [`coverAlt: ${yamlStr(coverAlt)}`] : [])] : []),
      'draft: true',
      `canonical: ${yamlStr(a.url)}`,
      '---',
      '',
    ].join('\n')
    fs.writeFileSync(path.join(POSTS_DIR, `${a.slug}.md`), `${fm}\n${body}\n`)

    // prune media this article no longer references (keeps re-runs idempotent when image numbering shifts)
    const mediaDir = path.join(MEDIA_DIR, a.slug)
    if (!NO_IMAGES && fs.existsSync(mediaDir)) {
      const keep = new Set([...ctx.images.values()].map((r) => path.basename(r.local)))
      for (const f of fs.readdirSync(mediaDir)) if (!keep.has(f)) fs.rmSync(path.join(mediaDir, f), { force: true })
    }

    const words = body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\s+/).filter(Boolean).length
    const entry = {
      id: a.id,
      slug: a.slug,
      title: a.title,
      url: a.url,
      author: a.creator ?? 'Michal Bodzianowski',
      date,
      updated,
      tags,
      words,
      mediumWordCount: a.wordCount,
      images: ctx.images.size + (coverPath && !ctx.images.size ? 1 : 0),
      captions: ctx.captions,
      cover: coverPath ?? null,
      imagesWithoutAlt: [...new Set(ctx.missingAlt)].length + (coverPath && !coverAlt ? 1 : 0),
      embeds: ctx.embeds,
      complete: !a.locked,
      notes: ctx.notes,
      unresolved: ctx.unresolved,
      warnings: ctx.warnings,
    }
    log.push(entry)
    console.log(`  wrote content/posts/${a.slug}.md  words=${words}  images=${entry.images}  embeds=${ctx.embeds.length}`)
    for (const m of [...ctx.notes, ...ctx.unresolved, ...ctx.warnings]) console.log(`  ! ${m}`)
  }

  if (!ONLY) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + '\n')
    console.log(`\nlog: ${path.relative(ROOT, LOG_FILE)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
