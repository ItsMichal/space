// Filesystem layer for the writing tool. Node only; imported exclusively by *.dev route handlers and pages.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp, { type Metadata } from 'sharp'
import type { PostFrontmatter, PostKind } from '@/lib/content/types'
import { SLUG_RE, parsePost, serializePost, slugify } from '@/lib/content/serialize'

const ROOT = process.cwd()
export const POSTS_DIR = path.join(ROOT, 'content', 'posts')
export const MEDIA_DIR = path.join(ROOT, 'public', 'media')
export const TRASH_DIR = path.join(ROOT, 'content', '.trash')

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

export type PostSummary = {
  id: string
  title: string
  slug: string
  kind: PostKind
  date: string
  updated?: string
  draft: boolean
  tags: string[]
  description: string
  words: number
  mtimeMs: number
}

export type PostFile = {
  id: string
  frontmatter: PostFrontmatter
  body: string
  hash: string
  mtimeMs: number
}

/* ------------------------------------------------------------------ helpers */

export function assertSlug(slug: string): string {
  if (!SLUG_RE.test(slug) || slug.length > 80) throw new HttpError(400, 'Invalid slug (use a-z, 0-9 and dashes)')
  return slug
}

function inside(dir: string, target: string) {
  const rel = path.relative(dir, target)
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

function postFile(slug: string): string {
  const file = path.join(POSTS_DIR, `${assertSlug(slug)}.md`)
  if (!inside(POSTS_DIR, file)) throw new HttpError(400, 'Invalid path')
  return file
}

function mediaDir(slug: string): string {
  const dir = path.join(MEDIA_DIR, assertSlug(slug))
  if (!inside(MEDIA_DIR, dir)) throw new HttpError(400, 'Invalid path')
  return dir
}

const hashOf = (raw: string) => crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16)
const today = () => new Date().toLocaleDateString('en-CA')
const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length

function atomicWrite(file: string, data: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

/* -------------------------------------------------------------------- posts */

export function listPosts(): PostSummary[] {
  if (!fs.existsSync(POSTS_DIR)) return []
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const id = f.replace(/\.md$/, '')
      const file = path.join(POSTS_DIR, f)
      const { frontmatter, body } = parsePost(fs.readFileSync(file, 'utf8'), id)
      return {
        id,
        title: frontmatter.title,
        slug: frontmatter.slug,
        kind: frontmatter.kind,
        date: frontmatter.date,
        ...(frontmatter.updated ? { updated: frontmatter.updated } : {}),
        draft: Boolean(frontmatter.draft),
        tags: frontmatter.tags,
        description: frontmatter.description,
        words: countWords(body),
        mtimeMs: fs.statSync(file).mtimeMs,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
}

export function readPost(id: string): PostFile {
  const file = postFile(id)
  if (!fs.existsSync(file)) throw new HttpError(404, 'Post not found')
  const raw = fs.readFileSync(file, 'utf8')
  const { frontmatter, body } = parsePost(raw, id)
  return { id, frontmatter, body, hash: hashOf(raw), mtimeMs: fs.statSync(file).mtimeMs }
}

export function allTags(): string[] {
  return [...new Set(listPosts().flatMap((p) => p.tags))].sort()
}

function validateFrontmatter(id: string, fm: PostFrontmatter) {
  if (typeof fm.title !== 'string') throw new HttpError(400, 'title is required')
  if (fm.slug !== id) throw new HttpError(400, 'slug differs from the file; use rename to change it')
  if (fm.kind !== 'project' && fm.kind !== 'article') throw new HttpError(400, 'kind must be project or article')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) throw new HttpError(400, 'date must be yyyy-mm-dd')
  if (fm.updated && !/^\d{4}-\d{2}-\d{2}$/.test(fm.updated)) throw new HttpError(400, 'updated must be yyyy-mm-dd')
  if (!Array.isArray(fm.tags)) throw new HttpError(400, 'tags must be a list')
  if (fm.cover && !fm.cover.startsWith('/media/')) throw new HttpError(400, 'cover must live under /media/')
  if (fm.parent) {
    if (!SLUG_RE.test(fm.parent) || fm.parent === id) throw new HttpError(400, 'parent must be the slug of another project')
    const parentFile = path.join(POSTS_DIR, `${fm.parent}.md`)
    if (!fs.existsSync(parentFile)) throw new HttpError(400, `parent project "${fm.parent}" does not exist`)
  }
  for (const g of fm.gallery ?? []) if (!g.src.startsWith('/media/')) throw new HttpError(400, 'gallery images must live under /media/')
}

export function writePost(
  id: string,
  input: { frontmatter: PostFrontmatter; body: string; baseHash?: string; force?: boolean }
): { hash: string; mtimeMs: number } {
  const file = postFile(id)
  validateFrontmatter(id, input.frontmatter)
  if (fs.existsSync(file)) {
    const current = hashOf(fs.readFileSync(file, 'utf8'))
    if (!input.force && input.baseHash && current !== input.baseHash) {
      throw new HttpError(409, 'The file changed on disk since it was loaded', { currentHash: current })
    }
  } else if (input.baseHash && !input.force) {
    // The editor had this file open, so it was deleted or renamed behind its back: never silently resurrect it.
    throw new HttpError(409, 'The file no longer exists on disk (renamed or deleted)')
  }
  const raw = serializePost(input.frontmatter, input.body)
  atomicWrite(file, raw)
  return { hash: hashOf(raw), mtimeMs: fs.statSync(file).mtimeMs }
}

export function createPost(input: { title?: string; kind?: PostKind }): PostFile {
  const title = (input.title ?? '').trim() || 'Untitled'
  const base = slugify(title) || 'untitled'
  let slug = base
  for (let n = 2; fs.existsSync(postFile(slug)); n++) slug = `${base}-${n}`
  const frontmatter: PostFrontmatter = {
    title,
    slug,
    kind: input.kind === 'project' ? 'project' : 'article',
    description: '',
    date: today(),
    tags: [],
    draft: true,
  }
  writePost(slug, { frontmatter, body: '' })
  return readPost(slug)
}

/** Move to content/.trash (never a hard delete). Media goes along so the folder is restorable as a unit. */
export function trashPost(id: string): { trashed: string } {
  const file = postFile(id)
  if (!fs.existsSync(file)) throw new HttpError(404, 'Post not found')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(TRASH_DIR, `${stamp}-${id}`)
  fs.mkdirSync(dest, { recursive: true })
  fs.renameSync(file, path.join(dest, `${id}.md`))
  const media = mediaDir(id)
  if (fs.existsSync(media)) fs.renameSync(media, path.join(dest, 'media'))
  return { trashed: path.relative(ROOT, dest) }
}

export function renamePost(id: string, newSlug: string): PostFile {
  assertSlug(newSlug)
  const from = postFile(id)
  const to = postFile(newSlug)
  if (!fs.existsSync(from)) throw new HttpError(404, 'Post not found')
  if (newSlug === id) return readPost(id)
  if (fs.existsSync(to)) throw new HttpError(409, 'A post with that slug already exists')
  const { frontmatter, body } = parsePost(fs.readFileSync(from, 'utf8'), id)
  const rewrite = (s: string) => s.split(`/media/${id}/`).join(`/media/${newSlug}/`)
  const next: PostFrontmatter = {
    ...frontmatter,
    slug: newSlug,
    ...(frontmatter.cover ? { cover: rewrite(frontmatter.cover) } : {}),
    ...(frontmatter.gallery ? { gallery: frontmatter.gallery.map((g) => ({ ...g, src: rewrite(g.src) })) } : {}),
  }
  const fromMedia = mediaDir(id)
  if (fs.existsSync(fromMedia)) {
    const toMedia = mediaDir(newSlug)
    if (fs.existsSync(toMedia)) throw new HttpError(409, 'A media folder for that slug already exists')
    fs.renameSync(fromMedia, toMedia)
  }
  atomicWrite(to, serializePost(next, rewrite(body)))
  fs.unlinkSync(from)
  // Children (progress logs, sub-pieces) follow their parent to its new slug.
  for (const f of fs.readdirSync(POSTS_DIR).filter((x) => x.endsWith('.md'))) {
    const file = path.join(POSTS_DIR, f)
    const child = parsePost(fs.readFileSync(file, 'utf8'), f.replace(/\.md$/, ''))
    if (child.frontmatter.parent === id) atomicWrite(file, serializePost({ ...child.frontmatter, parent: newSlug }, child.body))
  }
  return readPost(newSlug)
}

/* ------------------------------------------------------------------- upload */

const MAX_UPLOAD = 20 * 1024 * 1024
const MAX_WIDTH = 1600
const CONVERT_ABOVE = 250 * 1024
const ALLOWED = new Set(['png', 'jpeg', 'webp', 'gif', 'avif'])

export async function saveUpload(
  slug: string,
  file: { name: string; bytes: Buffer }
): Promise<{ src: string; width: number; height: number; bytes: number; converted: boolean }> {
  const dir = mediaDir(slug)
  if (!fs.existsSync(postFile(slug))) throw new HttpError(404, 'Post not found')
  if (file.bytes.length > MAX_UPLOAD) throw new HttpError(413, 'Image is larger than 20 MB')

  let meta: Metadata
  try {
    meta = await sharp(file.bytes, { animated: true }).metadata()
  } catch {
    throw new HttpError(415, 'Not a readable image')
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new HttpError(415, 'Only png, jpeg, webp, gif and avif are accepted')

  const animated = (meta.pages ?? 1) > 1
  const wide = (meta.width ?? 0) > MAX_WIDTH
  const convert = !animated && meta.format !== 'webp' && (wide || file.bytes.length > CONVERT_ABOVE)
  const resize = !animated && wide

  let out = file.bytes
  let ext = meta.format === 'jpeg' ? 'jpg' : meta.format
  if (convert || resize) {
    let img = sharp(file.bytes).rotate()
    if (resize) img = img.resize({ width: MAX_WIDTH, withoutEnlargement: true })
    if (convert || meta.format === 'webp') {
      out = await img.webp({ quality: 82 }).toBuffer()
      ext = 'webp'
    } else out = await img.toFormat(meta.format as 'png' | 'jpeg' | 'avif').toBuffer()
  }
  const info = await sharp(out).metadata()

  const base = slugify(path.basename(file.name, path.extname(file.name))) || 'image'
  const name = `${base}-${hashOf(out.toString('base64')).slice(0, 6)}.${ext}`
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), out)
  return {
    src: `/media/${slug}/${name}`,
    width: info.width ?? 0,
    height: info.height ?? 0,
    bytes: out.length,
    converted: convert || resize,
  }
}
