#!/usr/bin/env node
/**
 * One-shot (but re-runnable) exporter: public Notion workspace -> content/posts/*.md + public/media/<slug>/*
 *
 * Usage:
 *   node scripts/export-notion.mjs                 # export everything
 *   node scripts/export-notion.mjs --only slug     # export a single post
 *   node scripts/export-notion.mjs --force         # re-download media even if present
 *
 * Why curl and no notion-client: notion.so sits behind Cloudflare, which 403s Node's TLS
 * fingerprint (got/undici) but accepts curl. So this talks to the public (unauthenticated)
 * Notion web API through the system `curl`. Only dependency besides curl is `sharp` (already
 * a project dependency). Re-running overwrites content/posts/<slug>.md, so hand edits made after
 * export will be lost: treat Notion as the source only until the cutover is done.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const POSTS_DIR = path.join(ROOT, 'content', 'posts')
const MEDIA_DIR = path.join(ROOT, 'public', 'media')

const SPACE_ID = 'af3fadf6-4be0-49bd-a4a7-c8d74c43a4c4'
const ROOT_PAGE_ID = 'e25443a5-6e17-41da-9f6f-3e6e4b190653'
const COLLECTIONS = [
  // [collectionId, collectionViewId, kind]
  { id: 'c0861242-9f44-462e-b6b9-8a8f49601a71', view: 'd1925a20-2900-479c-9ee0-352add52d9d2', kind: 'project' },
  // ee083c5e-... is "Website Categories": a one-row database holding only the "Projects" index page,
  // so it contributes no posts. Add `{ id, view, kind: 'article' }` here for a future writing database.
]

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const warnings = []
const warn = (slug, msg) => {
  warnings.push(`[${slug}] ${msg}`)
  console.warn(`  ! ${msg}`)
}

/* ------------------------------------------------------------------ http */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
function curlJson(endpoint, body) {
  for (let attempt = 0; ; attempt++) {
    try {
      const out = execFileSync(
        'curl',
        ['-sS', '--fail', '-X', 'POST', `https://www.notion.so/api/v3/${endpoint}`, '-H', 'content-type: application/json', '-d', JSON.stringify(body)],
        { maxBuffer: 1 << 29, stdio: ['ignore', 'pipe', 'pipe'] }
      )
      sleep(250) // be polite: Notion rate-limits (429) quickly
      return JSON.parse(out.toString('utf8'))
    } catch (e) {
      if (attempt >= 10) throw e
      sleep(6000 * (attempt + 1))
    }
  }
}
function curlFile(url, dest) {
  execFileSync('curl', ['-sSL', '--fail', '--retry', '2', '-A', 'Mozilla/5.0', '-o', dest, url], { maxBuffer: 1 << 24 })
}
const unwrap = (r) => r?.value?.value ?? r?.value

/* ------------------------------------------------------------------ notion fetch */
function mergeBlocks(into, recordMap) {
  for (const [id, rec] of Object.entries(recordMap?.block ?? {})) {
    const v = unwrap(rec)
    if (v) into[id] = v
  }
}

function fetchPage(pageId) {
  const blocks = {}
  let cursor = { stack: [] }
  let chunk = 0
  for (;;) {
    const j = curlJson('loadPageChunk', { page: { id: pageId }, limit: 100, cursor, chunkNumber: chunk, verticalColumns: false })
    mergeBlocks(blocks, j.recordMap)
    cursor = j.cursor
    chunk++
    if (!cursor?.stack?.length) break
  }
  // pull in any referenced child blocks that were not included
  for (;;) {
    const missing = new Set()
    for (const b of Object.values(blocks)) {
      for (const c of b.content ?? []) if (!blocks[c]) missing.add(c)
    }
    if (!missing.size) break
    const ids = [...missing]
    for (let i = 0; i < ids.length; i += 50) {
      const j = curlJson('syncRecordValuesMain', {
        requests: ids.slice(i, i + 50).map((id) => ({ pointer: { table: 'block', id, spaceId: SPACE_ID }, version: -1 })),
      })
      mergeBlocks(blocks, j.recordMap)
    }
    // guard against ids that never resolve
    for (const id of ids) if (!blocks[id]) blocks[id] = { id, type: 'unresolved', content: [] }
  }
  return blocks
}

function queryCollection({ id, view }) {
  const j = curlJson('queryCollection', {
    collection: { id, spaceId: SPACE_ID },
    collectionView: { id: view, spaceId: SPACE_ID },
    loader: { type: 'reducer', reducers: { collection_group_results: { type: 'results', limit: 999 } }, searchQuery: '', userTimeZone: 'UTC' },
  })
  const ids = j.result?.reducerResults?.collection_group_results?.blockIds ?? []
  const schema = unwrap(j.recordMap.collection[id]).schema
  const rows = ids.map((bid) => unwrap(j.recordMap.block[bid])).filter((b) => b && b.alive !== false && b.type === 'page')
  return { schema, rows }
}

/* ------------------------------------------------------------------ helpers */
const plain = (rt) => (rt ?? []).map((s) => (s[0] === '‣' ? '' : s[0])).join('')
const slugify = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'file'
const stripEmoji = (s) =>
  s.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍\s]+/u, '').trim()
const yamlStr = (s) => JSON.stringify(s)
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10)
const sanitizeAlt = (s) => s.replace(/\s+/g, ' ').replace(/[\[\]]/g, '').trim()

function propByName(schema, row, name) {
  const key = Object.keys(schema).find((k) => schema[k].name === name)
  return key ? row.properties?.[key] : undefined
}

/* ------------------------------------------------------------------ media */
let mediaCtx = null // {slug, dir, urlBase}
function resolveSource(url, block) {
  if (url.startsWith('/images/')) return `https://www.notion.so${url}` // Notion built-in covers
  if (/^https?:\/\//.test(url) && !/notion\.so|notion-static|amazonaws\.com/.test(url)) return url // external (e.g. unsplash)
  // signed URL (works for attachment:, S3, and other private files)
  try {
    const j = curlJson('getSignedFileUrls', { urls: [{ url, permissionRecord: { table: 'block', id: block.id } }] })
    if (j.signedUrls?.[0]) return j.signedUrls[0]
  } catch {}
  return `https://www.notion.so/image/${encodeURIComponent(url)}?table=block&id=${block.id}&cache=v2`
}

/**
 * Download a Notion file to public/media/<slug>/ and return its public path.
 * Large rasters become webp <= 2000px wide.
 */
async function saveMedia(url, block, { name, stem }) {
  if (!url) return null
  if (/^https?:\/\//.test(url) && !/notion|amazonaws|notion-static/.test(url)) {
    // external hosted image: still download so the site is self-contained
  }
  const dir = mediaCtx.dir
  fs.mkdirSync(dir, { recursive: true })
  const origExt = (path.extname(new URL(url.startsWith('attachment:') ? 'http://x/' + url.split(':').pop() : url, 'http://x').pathname) || '').toLowerCase()
  const baseStem = stem ?? `${slugify(path.basename(name || 'file', origExt))}-${block.id.replace(/-/g, '').slice(0, 6)}`
  const existing = fs.readdirSync(dir).find((f) => f.slice(0, f.lastIndexOf('.')) === baseStem)
  if (existing && !FORCE) return `${mediaCtx.urlBase}/${existing}`

  const tmp = path.join(dir, `.${baseStem}.tmp`)
  const src = resolveSource(url, block)
  try {
    curlFile(src, tmp)
  } catch (e) {
    fs.rmSync(tmp, { force: true })
    throw new Error(`download failed for ${url.slice(0, 80)}: ${e.message.split('\n')[0]}`)
  }
  let buf = fs.readFileSync(tmp)
  let ext = origExt === '.jpeg' ? '.jpg' : origExt
  if (ext === '.heic' || ext === '.heif') {
    // sharp's prebuilt libheif has no HEVC decoder; use macOS `sips` to get a JPEG first.
    try {
      const jpg = `${tmp}.jpg`
      execFileSync('sips', ['-s', 'format', 'jpeg', tmp, '--out', jpg], { stdio: 'ignore' })
      buf = fs.readFileSync(jpg)
      fs.rmSync(jpg)
      ext = '.jpg'
    } catch {
      warn(mediaCtx.slug, `${name}: HEIC conversion needs macOS sips; left as .heic`)
    }
  }
  fs.rmSync(tmp)
  const raster = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.heic', ''].includes(origExt)
  let out = buf
  if (raster) {
    try {
      const img = sharp(buf, { animated: true })
      const meta = await img.metadata()
      if (!ext) ext = '.' + (meta.format === 'jpeg' ? 'jpg' : meta.format)
      const tooWide = (meta.width ?? 0) > 2000
      if (buf.length > 400 * 1024 || tooWide) {
        out = await sharp(buf, { animated: true })
          .resize({ width: 2000, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer()
        ext = '.webp'
      }
    } catch (e) {
      warn(mediaCtx.slug, `could not process image ${name}: ${e.message}`)
    }
  }
  const file = `${baseStem}${ext || '.bin'}`
  fs.writeFileSync(path.join(dir, file), out)
  return `${mediaCtx.urlBase}/${file}`
}

/* ------------------------------------------------------------------ rich text */
function escapeMd(t) {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/([*_`\[\]|~])/g, '\\$1')
    .replace(/<(?=[A-Za-z/!?])/g, '\\<')
}

// Escape characters that only matter at the start of a line (headings, lists, quotes).
const escapeLineStarts = (s) =>
  s.replace(/(^|\n)(\s*)([#>+-])(\s)/g, '$1$2\\$3$4').replace(/(^|\n)(\s*)(\d+)\.(\s)/g, '$1$2$3\\.$4')

function richText(rt, ctx) {
  if (!rt?.length) return ''
  let out = ''
  for (const [text, fmts = []] of rt) {
    let s
    const f = Object.fromEntries(fmts.map((x) => [x[0], x[1]]))
    if (text === '‣') {
      if (f.p) {
        const target = ctx.pageRefs.get(f.p.replace(/-/g, ''))
        const label = ctx.pageTitles.get(f.p.replace(/-/g, '')) ?? 'page'
        s = target ? `[${escapeMd(label)}](${target})` : escapeMd(label)
        if (!target) warn(ctx.slug, `page mention to unknown page ${f.p}`)
      } else if (f.d) {
        s = f.d.start_date ?? ''
      } else {
        s = ''
      }
      out += s
      continue
    }
    if (f.e) {
      out += '`' + f.e.replace(/`/g, "'") + '`'
      continue
    }
    if (f.c) {
      s = '`' + text.replace(/`/g, "'") + '`'
    } else {
      s = escapeMd(text)
    }
    // keep whitespace outside of emphasis markers
    const lead = s.match(/^\s*/)[0]
    const trail = s.match(/\s*$/)[0]
    let core = s.trim()
    if (core) {
      if (f.b) core = `**${core}**`
      if (f.i) core = `_${core}_`
      if (f.s) core = `~~${core}~~`
      if (f.a) {
        let href = f.a
        if (href.startsWith('/')) {
          const m = href.match(/^\/([0-9a-f]{32})/)
          href = (m && ctx.pageRefs.get(m[1])) || `https://www.notion.so${href}`
        }
        core = `[${core}](${href.replace(/\)/g, '%29')})`
      }
    }
    out += lead + core + trail
  }
  return escapeLineStarts(out)
}

/* ------------------------------------------------------------------ blocks */
const LANG = {
  'plain text': 'text', 'c++': 'cpp', 'c#': 'csharp', 'objective-c': 'objc', 'f#': 'fsharp',
  'shell': 'bash', 'webassembly': 'wasm', 'vb.net': 'vb', 'visual basic': 'vb', 'java/c/c++/c#': 'text',
}
const CALLOUT_TYPE = { '💡': 'tip', '⚠️': 'warning', '🚨': 'warning', '❗': 'warning', '📝': 'note' }

const headingText = (t) => stripEmoji(t.replace(/\n/g, ' '))
const indentLines = (s, pad) => s.split('\n').map((l) => (l ? pad + l : l)).join('\n')

function youtubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/)
  return m ? m[1] : null
}

async function renderBlocks(ids, ctx, blocks, depth = 0) {
  const parts = []
  let numbered = 0
  let prevType = null
  for (const id of ids) {
    const b = blocks[id]
    if (!b || b.alive === false) continue
    if (b.type !== 'numbered_list') numbered = 0
    const md = await renderBlock(b, ctx, blocks, depth, () => ++numbered)
    if (md == null || md === '') {
      continue
    }
    const isList = ['bulleted_list', 'numbered_list', 'to_do'].includes(b.type)
    const prevList = ['bulleted_list', 'numbered_list', 'to_do'].includes(prevType)
    parts.push({ md, joinTight: isList && prevList })
    prevType = b.type
  }
  return parts.map((p, i) => (i === 0 ? p.md : (p.joinTight ? '\n' : '\n\n') + p.md)).join('')
}

async function children(b, ctx, blocks, depth) {
  if (!b.content?.length) return ''
  return renderBlocks(b.content, ctx, blocks, depth + 1)
}

async function mediaBlock(b, ctx, kindLabel) {
  const p = b.properties ?? {}
  const src = p.source?.[0]?.[0] ?? b.format?.display_source
  if (!src) return null
  const caption = plain(p.caption)
  const name = decodeURIComponent((src.split('?')[0].split('/').pop() || 'file').replace(/^attachment:[^:]+:/, ''))
  try {
    const local = await saveMedia(src, b, { name })
    ctx.imageCount++
    return { local, caption, name }
  } catch (e) {
    warn(ctx.slug, `${kindLabel} ${b.id}: ${e.message}`)
    return null
  }
}

async function renderBlock(b, ctx, blocks, depth, nextNumber) {
  const t = b.type
  const p = b.properties ?? {}
  const text = () => richText(p.title, ctx)
  ctx.types[t] = (ctx.types[t] ?? 0) + 1
  switch (t) {
    case 'text': {
      const s = text()
      const kids = await children(b, ctx, blocks, depth)
      if (!s && !kids) return ''
      return [s, kids].filter(Boolean).join('\n\n')
    }
    case 'header':
    case 'sub_header':
    case 'sub_sub_header': {
      const level = { header: 2, sub_header: 3, sub_sub_header: 4 }[t]
      ctx.headingLevel = level
      const kids = await children(b, ctx, blocks, depth)
      return `${'#'.repeat(level)} ${headingText(text())}` + (kids ? `\n\n${kids}` : '')
    }
    case 'bulleted_list':
    case 'numbered_list':
    case 'to_do': {
      const marker =
        t === 'bulleted_list' ? '-' : t === 'numbered_list' ? `${nextNumber()}.` : p.checked?.[0]?.[0] === 'Yes' ? '- [x]' : '- [ ]'
      const pad = ' '.repeat(marker.length + 1)
      const kids = await children(b, ctx, blocks, depth)
      const first = text().replace(/\n/g, '\\\n' + pad)
      const kidsMd = kids ? '\n' + indentLines(kids.replace(/\n\n/g, '\n\n'), pad) : ''
      return `${marker} ${first}${kidsMd}`
    }
    case 'quote': {
      const kids = await children(b, ctx, blocks, depth)
      const body = [text(), kids].filter(Boolean).join('\n\n')
      return body.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n')
    }
    case 'callout': {
      const icon = b.format?.page_icon ?? ''
      const type = CALLOUT_TYPE[icon] ?? 'note'
      const kids = await children(b, ctx, blocks, depth)
      const body = [text(), kids].filter(Boolean).join('\n\n')
      return `:::callout{type="${type}"}\n${body}\n:::`
    }
    case 'code': {
      const lang = LANG[(p.language?.[0]?.[0] ?? 'text').toLowerCase()] ?? (p.language?.[0]?.[0] ?? 'text').toLowerCase()
      const code = plain(p.title)
      const fence = '`'.repeat(Math.max(3, ...(code.match(/`+/g) ?? []).map((m) => m.length + 1)))
      const cap = plain(p.caption)
      return `${fence}${lang}\n${code}\n${fence}` + (cap ? `\n\n_${escapeMd(cap)}_` : '')
    }
    case 'equation': {
      const code = plain(p.title)
      return code ? '```latex\n' + code + '\n```' : ''
    }
    case 'divider':
      return '---'
    case 'toggle': {
      const level = Math.min(6, (ctx.headingLevel ?? 2) + 1)
      const kids = await children(b, ctx, blocks, depth)
      return `${'#'.repeat(level)} ${headingText(text())}` + (kids ? `\n\n${kids}` : '')
    }
    case 'column_list':
    case 'column':
      return renderBlocks(b.content ?? [], ctx, blocks, depth)
    case 'table': {
      const order = b.format?.table_block_column_order ?? []
      const rows = (b.content ?? []).map((rid) => blocks[rid]).filter(Boolean)
      if (!rows.length || !order.length) return ''
      const cell = (r, col) => richText(r.properties?.[col], ctx).replace(/\|/g, '\\|').replace(/\n/g, ' ')
      const headerRow = b.format?.table_block_column_header ? rows[0] : null
      const body = headerRow ? rows.slice(1) : rows
      const head = headerRow ? order.map((c) => cell(headerRow, c)) : order.map(() => ' ')
      const lines = [`| ${head.join(' | ')} |`, `| ${order.map(() => '---').join(' | ')} |`]
      for (const r of body) lines.push(`| ${order.map((c) => cell(r, c)).join(' | ')} |`)
      return lines.join('\n')
    }
    case 'image': {
      const m = await mediaBlock(b, ctx, 'image')
      if (!m) return ''
      ctx.imageIndex++
      const alt = sanitizeAlt(m.caption) || `${ctx.title}: figure ${ctx.imageIndex}`
      const title = m.caption ? ` "${m.caption.replace(/"/g, "'").replace(/\s+/g, ' ')}"` : ''
      return `![${alt}](${m.local}${title})`
    }
    case 'video': {
      const src = p.source?.[0]?.[0] ?? b.format?.display_source ?? ''
      const yt = youtubeId(src)
      if (yt) return `::youtube{id="${yt}"}`
      if (/^https:\/\/(player\.vimeo\.com|www\.loom\.com|vimeo\.com)/.test(src)) {
        const url = src.replace('vimeo.com/', 'player.vimeo.com/video/').replace('player.player.', 'player.')
        return `::embed{url="${url}"}`
      }
      // uploaded video file: store it and link (no <video> renderer yet)
      const m = await mediaBlock(b, ctx, 'video')
      if (!m) return ''
      warn(ctx.slug, `uploaded video saved as ${m.local} and linked (renderer has no <video> support)`)
      return `[${sanitizeAlt(m.caption) || 'Watch the video'}](${m.local})`
    }
    case 'audio':
    case 'file':
    case 'pdf': {
      const m = await mediaBlock(b, ctx, t)
      if (!m) return ''
      return `[${sanitizeAlt(m.caption) || m.name}](${m.local})`
    }
    case 'embed':
    case 'bookmark':
    case 'tweet':
    case 'figma':
    case 'gist':
    case 'maps':
    case 'codepen':
    case 'drive':
    case 'link_preview': {
      const url = p.source?.[0]?.[0] ?? p.link?.[0]?.[0] ?? b.format?.display_source ?? ''
      if (!url) return ''
      const yt = youtubeId(url)
      if (yt) return `::youtube{id="${yt}"}`
      if (t === 'bookmark' || t === 'link_preview') {
        // Arbitrary sites usually refuse to be framed, and a real link is better for SEO: link, don't iframe.
        let host = url
        try { host = new URL(url).hostname.replace(/^www\./, '') } catch {}
        const label = plain(p.title) || plain(p.caption) || host
        return `[${escapeMd(label)}](${url})`
      }
      return `::embed{url="${url}"}`
    }
    case 'external_object_instance': {
      // Notion's rich link cards (GitHub, Figma, ...): export as a plain link.
      const uri = b.format?.original_url ?? b.format?.uri
      const label = b.format?.attributes?.find((a) => a.id === 'title')?.values?.[0] ?? uri
      return uri ? `[${escapeMd(String(label))}](${uri})` : ''
    }
    case 'page': // child page
    case 'link_to_page':
    case 'alias': {
      warn(ctx.slug, `child/linked page block ${b.id} (${plain(p.title)}) skipped`)
      return ''
    }
    case 'table_of_contents':
    case 'breadcrumb':
    case 'unresolved':
      if (t === 'unresolved') warn(ctx.slug, `block ${b.id} could not be resolved`)
      return ''
    case 'collection_view':
    case 'collection_view_page': {
      // Inline database whose rows were exported as their own articles: render a link list.
      const linked = ctx.viewLinks.get(b.id)
      if (!linked?.length) {
        warn(ctx.slug, `inline database ${b.id} skipped`)
        return ''
      }
      return linked.map((l) => `- [${escapeMd(l.title)}](${l.href})`).join('\n')
    }
    default:
      warn(ctx.slug, `unsupported block type "${t}" (${b.id}) skipped`)
      return ''
  }
}


/* ------------------------------------------------------------------ main */
function firstSentence(md, max = 158) {
  const line = md
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !/^([#>:`!\-|*]|\d+\.|::)/.test(l))
  if (!line) return ''
  const t = line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…'
}

function descendants(rootId, blocks, seen = new Set()) {
  for (const c of blocks[rootId]?.content ?? []) {
    if (seen.has(c)) continue
    seen.add(c)
    descendants(c, blocks, seen)
  }
  return [...seen].map((id) => blocks[id]).filter(Boolean)
}

function findSubCollections(rootId, blocks) {
  const out = []
  // only blocks inside this page: loadPageChunk also returns ancestor/sibling blocks
  for (const b of descendants(rootId, blocks)) {
    if (b.type !== 'collection_view' && b.type !== 'collection_view_page') continue
    const viewId = b.view_ids?.[0]
    if (!viewId) continue
    let collectionId = b.collection_id
    if (!collectionId) {
      const j = curlJson('syncRecordValuesMain', {
        requests: [{ pointer: { table: 'collection_view', id: viewId, spaceId: SPACE_ID }, version: -1 }],
      })
      const view = unwrap(Object.values(j.recordMap.collection_view ?? {})[0])
      collectionId = view?.format?.collection_pointer?.id
    }
    if (collectionId) out.push({ blockId: b.id, collectionId, viewId })
  }
  return out
}

async function main() {
  console.log('Querying collections…')
  const posts = []
  const all = COLLECTIONS.map((c) => ({ c, ...queryCollection(c) }))
  let priority = all.reduce((n, a) => n + a.rows.length, 0)
  for (const { c, schema, rows } of all) {
    for (const row of rows) {
      const slugRaw = plain(propByName(schema, row, 'Slug')) || slugify(plain(row.properties?.title))
      posts.push({
        row,
        kind: c.kind,
        slug: slugify(slugRaw),
        title: stripEmoji(plain(row.properties.title)) || 'Untitled',
        description: plain(propByName(schema, row, 'Description')).replace(/\s+/g, ' ').trim(),
        tags: plain(propByName(schema, row, 'Tags')).split(',').map((s) => s.trim()).filter(Boolean),
        priority: priority--,
      })
    }
  }

  // Fetch every page; discover inline databases (e.g. Mountaintop's progress blog) -> articles.
  const pageBlocks = new Map()
  const viewLinks = new Map()
  for (const post of [...posts]) {
    console.log(`fetching ${post.slug}`)
    const blocks = fetchPage(post.row.id)
    pageBlocks.set(post.row.id, blocks)
    for (const sub of findSubCollections(post.row.id, blocks)) {
      const { schema, rows } = queryCollection({ id: sub.collectionId, view: sub.viewId })
      const links = []
      const prefix = post.slug.replace(/^project-/, '')
      for (const row of rows) {
        const title = stripEmoji(plain(row.properties?.title))
        if (!title) {
          warn(post.slug, `sub-database row ${row.id} has no title; skipped`)
          continue
        }
        if (!row.content?.length) {
          warn(post.slug, `sub-database row "${title}" is empty; skipped`)
          continue
        }
        const slug = slugify(`${prefix}-${title}`)
        const subTags = plain(propByName(schema, row, 'Tags')).split(',').map((s) => s.trim()).filter(Boolean)
        posts.push({
          row,
          kind: 'article',
          slug,
          title,
          description: plain(propByName(schema, row, 'Description')).replace(/\s+/g, ' ').trim(),
          tags: [...new Set([post.title, ...subTags])],
          priority: undefined,
          parent: post.slug,
        })
        links.push({ title, href: `/writing/${slug}` })
        pageBlocks.set(row.id, fetchPage(row.id))
      }
      // oldest first reads best for a dev log
      links.reverse()
      viewLinks.set(sub.blockId, links)
    }
  }

  // maps used to rewrite internal links / mentions
  const pageRefs = new Map()
  const pageTitles = new Map()
  for (const p of posts) {
    const base = p.kind === 'project' ? '/projects' : '/writing'
    pageRefs.set(p.row.id.replace(/-/g, ''), `${base}/${p.slug}`)
    pageTitles.set(p.row.id.replace(/-/g, ''), p.title)
  }

  fs.mkdirSync(POSTS_DIR, { recursive: true })
  const summary = []
  for (const post of posts) {
    if (ONLY && post.slug !== ONLY) continue
    console.log(`\n${post.kind}: ${post.slug} (${post.title})`)
    const blocks = pageBlocks.get(post.row.id)
    const row = blocks[post.row.id] ?? post.row
    mediaCtx = { slug: post.slug, dir: path.join(MEDIA_DIR, post.slug), urlBase: `/media/${post.slug}` }
    const ctx = { slug: post.slug, title: post.title, pageRefs, pageTitles, viewLinks, imageCount: 0, imageIndex: 0, headingLevel: 2, types: {} }

    let cover
    const coverSrc = row.format?.page_cover
    if (coverSrc) {
      try {
        cover = await saveMedia(coverSrc, row, { name: 'cover', stem: 'cover' })
        ctx.imageCount++
      } catch (e) {
        warn(post.slug, `cover: ${e.message}`)
      }
    }

    const body = (await renderBlocks(row.content ?? [], ctx, blocks)).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
    const description = post.description || firstSentence(body) || post.title
    const fm = [
      '---',
      `title: ${yamlStr(post.title)}`,
      `slug: ${post.slug}`,
      `kind: ${post.kind}`,
      `description: ${yamlStr(description)}`,
      `date: ${isoDate(row.created_time)}`,
      ...(row.last_edited_time && isoDate(row.last_edited_time) !== isoDate(row.created_time) ? [`updated: ${isoDate(row.last_edited_time)}`] : []),
      `tags: [${post.tags.map(yamlStr).join(', ')}]`,
      ...(cover ? [`cover: ${cover}`, `coverAlt: ${yamlStr(`${post.title} cover image`)}`] : []),
      ...(post.priority != null ? [`priority: ${post.priority}`] : []),
      '---',
      '',
    ].join('\n')
    const file = path.join(POSTS_DIR, `${post.slug}.md`)
    fs.writeFileSync(file, fm + '\n' + body + '\n')
    summary.push({ slug: post.slug, kind: post.kind, images: ctx.imageCount })
    console.log(`  wrote ${path.relative(ROOT, file)} (${ctx.imageCount} media)`)
  }

  console.log('\nSummary')
  console.table(summary)
  if (warnings.length) {
    console.log('\nWarnings')
    for (const w of warnings) console.log(' -', w)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
