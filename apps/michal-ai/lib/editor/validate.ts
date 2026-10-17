// Pure content checks shared by the local writing API (lib/editor/server/posts.ts) and the hosted editor's Worker
// (write/worker). Relative imports only: the Worker bundle has no `@/` alias.
import type { PostFrontmatter } from '../content/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Front matter schema for a post file named `<id>.md`. Returns the first problem, or null. The parent's existence is checked by the caller. */
export function frontmatterProblem(id: string, fm: PostFrontmatter): string | null {
  if (typeof fm.title !== 'string') return 'title is required'
  if (fm.slug !== id) return 'slug differs from the file; use rename to change it'
  if (fm.kind !== 'project' && fm.kind !== 'article') return 'kind must be project or article'
  if (!ISO_DATE.test(fm.date)) return 'date must be yyyy-mm-dd'
  if (fm.updated && !ISO_DATE.test(fm.updated)) return 'updated must be yyyy-mm-dd'
  if (!Array.isArray(fm.tags)) return 'tags must be a list'
  if (fm.cover && !fm.cover.startsWith('/media/')) return 'cover must live under /media/'
  if (fm.parent && (!/^[a-z0-9-]+$/.test(fm.parent) || fm.parent === id)) return 'parent must be the slug of another project'
  for (const g of fm.gallery ?? []) if (!g.src.startsWith('/media/')) return 'gallery images must live under /media/'
  return null
}

/** The rules of scripts/check-slugs.mjs for one slug: lowercase ASCII words joined by single hyphens, at most 60 characters. */
export const STRICT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function slugProblem(slug: string): string | null {
  if (!STRICT_SLUG_RE.test(slug)) return `slug "${slug}" must be lowercase a-z, 0-9 and single hyphens`
  if (slug.length > 60) return `slug "${slug}" is ${slug.length} characters (max 60)`
  return null
}

// The dash guard of scripts/check-dashes.mjs (a test keeps the two in step). Built from char codes so this file passes the guard itself.
const EM = String.fromCharCode(0x2014)
const EN = String.fromCharCode(0x2013)
const AMP = '&'
export const DASH_RE = new RegExp(
  `[${EN}${EM}]|${AMP}mdash;|${AMP}ndash;|${AMP}#8212;|${AMP}#8211;|\\\\u201[34]|\\\\u\\{201[34]\\}`,
  'i'
)

/** Lines (1-based) that would fail `npm run check:dashes`. */
export function dashLines(text: string): { line: number; text: string }[] {
  return text.split('\n').flatMap((t, i) => (DASH_RE.test(t) ? [{ line: i + 1, text: t.trim().slice(0, 120) }] : []))
}

