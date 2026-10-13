// Pure pieces of the content-identity guard, split out of check-identity.mjs so they can be unit tested
// (packages/crosslinks/src/identity.test.mjs).
//
// Rule: halmic.com never prints the owner's real name, initials or portfolio domain. The owner chose to open exactly one
// door: the logo switcher (header and its touch fallback in the footer) and one link per paired piece of content. The door is
// described by data (packages/crosslinks), and this file turns that data into an allowlist of
// { file, text, max }: the exact string, the exact file it may appear in, and how many times. Occurrences beyond `max`, in
// any other file, or with any other spelling are not allowed, so a second mention fails.
import { PAIRS, MICHAL_ORIGIN, MICHAL_DOMAIN, michalLinkFor } from '../packages/crosslinks/src/index.mjs'

const HTML_UNDER_PUBLIC = /^apps\/halmic\/public\/(?:.*\/)?[^/]+\.html$/

/** The exact markup the halmic build emits for the switcher: header link plus the footer (touch) link. Two of each. */
export const SWITCH_HREF = `href="${MICHAL_ORIGIN}"`
export const SWITCH_LABEL = `>${MICHAL_DOMAIN}<`

/**
 * What may appear in a halmic file, as [{ text, max }] (empty for files with no allowance).
 * posts = the michal.ai posts ({ id, slug, kind, parent }), used to resolve each pair to its current URL.
 */
export function halmicAllowances(relPath, posts) {
  if (!HTML_UNDER_PUBLIC.test(relPath)) return []
  const out = [
    { text: SWITCH_HREF, max: 2 }, // logo switcher in the header, same link in the footer for touch screens
    { text: SWITCH_LABEL, max: 2 },
  ]
  for (const pair of PAIRS) {
    if (relPath !== `apps/halmic/public${pair.halmic}index.html`) continue
    const link = michalLinkFor(pair.halmic, posts)
    out.push({ text: `href="${link.href}"`, max: 1 }, { text: SWITCH_LABEL, max: 1 })
  }
  // merge duplicates (same text): budgets add up
  const merged = new Map()
  for (const a of out) merged.set(a.text, (merged.get(a.text) ?? 0) + a.max)
  return [...merged].map(([text, max]) => ({ text, max }))
}

/** Blank out up to `max` occurrences of each allowed string, leaving everything else (including surplus occurrences). */
export function stripAllowed(content, allowances) {
  let s = content
  for (const { text, max } of allowances) {
    let n = 0
    let i = 0
    let out = ''
    for (;;) {
      const j = s.indexOf(text, i)
      if (j < 0 || n >= max) break
      out += s.slice(i, j) + ' '.repeat(text.length)
      i = j + text.length
      n++
    }
    s = out + s.slice(i)
  }
  return s
}

/** Scan one file's content for denied patterns after removing the allowed occurrences. Returns [{ line, match }]. */
export function scanContent(content, patterns, allowances = []) {
  const hits = []
  stripAllowed(content, allowances)
    .split('\n')
    .forEach((line, i) => {
      for (const re of patterns) {
        const m = line.match(re)
        if (m) hits.push({ line: i + 1, match: m[0] })
      }
    })
  return hits
}
