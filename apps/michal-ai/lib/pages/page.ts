// A private page file (pages/<id>.md in space-content): parse and check it. No fs access, so the build and the editor's Worker share
// it. Writing a file and making tokens is text.ts, which has no gray-matter so the editor's browser code can use it. The rules are
// lib/content/pages.mjs; how pages are served is docs/private-pages.md.
import matter from 'gray-matter'
import { SAFE_MATTER } from '../content/rules.mjs'
import { pageIdProblem, pageProblems, parsePageData, type PageData, type PageLink } from '../content/pages.mjs'

export type { PageData, PageLink }
export { newToken, pageUrl, serializePage } from './text'
export type PageFile = { id: string; page: PageData; body: string }

/** Parse a page file. Returns the checked page and body, or every problem the content rules find (none of them quote the page). */
export function parsePage(raw: string, id: string): { file: PageFile; problems: [] } | { file?: undefined; problems: string[] } {
  const ip = pageIdProblem(id)
  if (ip) return { problems: [ip] }
  let parsed: { data: Record<string, unknown>; content: string }
  try {
    parsed = matter(String(raw), SAFE_MATTER)
  } catch {
    return { problems: ['front matter does not parse as YAML'] }
  }
  const problems = pageProblems(raw, parsed.data, parsed.content)
  const r = parsePageData(parsed.data)
  if (problems.length || !r.page) return { problems: problems.length ? problems : [r.problem ?? 'not a page'] }
  return { file: { id, page: r.page, body: parsed.content.trim() }, problems: [] }
}
