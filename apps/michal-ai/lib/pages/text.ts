// Writing a private page file and making its link tokens. No dependencies, so the editor's browser code can use it too (page.ts
// parses with gray-matter, which needs Node's Buffer). How pages are served is docs/private-pages.md.
import type { PageData } from '../content/pages.mjs'

const q = (s: string) => JSON.stringify(s)

/** The file text for a page: front matter in a fixed key order, a blank line, the body. Strings are always quoted. */
export function serializePage(page: PageData, body: string): string {
  const lines = [`title: ${q(page.title)}`]
  if (page.description) lines.push(`description: ${q(page.description)}`)
  if (page.date) lines.push(`date: ${page.date}`)
  if (page.expires) lines.push(`expires: ${page.expires}`)
  if (page.disabled) lines.push('disabled: true')
  lines.push('links:')
  for (const l of page.links) {
    lines.push(`  - token: ${q(l.token)}`, `    label: ${q(l.label)}`)
    if (l.expires) lines.push(`    expires: ${l.expires}`)
    if (l.revoked) lines.push('    revoked: true')
  }
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** A new link token: 22 characters of base64url, 132 random bits. Never derived from anything, so it cannot be guessed. */
export function newToken(random: (n: Uint8Array) => Uint8Array = (n) => crypto.getRandomValues(n)): string {
  const bytes = random(new Uint8Array(22))
  return [...bytes].map((b) => ALPHABET[b & 63]).join('')
}

/** The public URL of a link. */
export const pageUrl = (token: string, origin = 'https://michal.ai') => `${origin}/p/${token}`
