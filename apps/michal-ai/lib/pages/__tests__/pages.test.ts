import { describe, expect, it } from 'vitest'
import { linkOpen, linkUntil, pageIdProblem, pageProblems, pageTokenClashes, parsePageData, PAGES } from '../../content/pages.mjs'
import { newToken, pageUrl, parsePage, serializePage, type PageData } from '../page'
import { pageKey, pagesManifest } from '../build.mjs'

const T1 = 'AAAAAAAAAAAAAAAAAAAAAA'
const T2 = 'BBBBBBBBBBBBBBBBBBBBBB_-'
const page = (over: Partial<PageData> = {}): PageData => ({ title: 'For the team', links: [{ token: T1, label: 'Hiring manager' }], ...over })

describe('private page front matter', () => {
  it('accepts a minimal page and copies only checked fields', () => {
    const r = parsePageData({ title: 'Hi', links: [{ token: T1, label: 'x' }] })
    expect(r.page).toEqual({ title: 'Hi', links: [{ token: T1, label: 'x' }] })
  })

  it('normalises YAML dates and keeps flags only when true', () => {
    const r = parsePageData({ title: 'Hi', date: new Date('2026-11-13T00:00:00Z'), expires: '2027-01-31', disabled: false, links: [{ token: T1, label: '', expires: new Date('2026-12-01'), revoked: false }] })
    expect(r.page).toEqual({ title: 'Hi', date: '2026-11-13', expires: '2027-01-31', links: [{ token: T1, label: '', expires: '2026-12-01' }] })
  })

  it.each([
    [{ links: [{ token: T1, label: 'x' }] }, 'title is required'],
    [{ title: 'x', links: [] }, 'links must list at least one link'],
    [{ title: 'x', links: [{ token: 'short', label: 'x' }] }, 'token must be'],
    [{ title: 'x', links: [{ token: T1, label: 'a' }, { token: T1, label: 'b' }] }, 'token is used twice'],
    [{ title: 'x', slug: 'y', links: [{ token: T1, label: 'x' }] }, 'unknown front matter key'],
    [{ title: 'x', links: [{ token: T1, label: 'x', href: 'y' }] }, 'unknown key'],
    [{ title: 'x', expires: 'soon', links: [{ token: T1, label: 'x' }] }, 'expires must be yyyy-mm-dd'],
    [{ title: 'x', disabled: 'yes', links: [{ token: T1, label: 'x' }] }, 'disabled must be true or false'],
    [{ title: 'x'.repeat(PAGES.title + 1), links: [{ token: T1, label: 'x' }] }, 'title must be plain text'],
    [{ title: 'x', links: Array.from({ length: PAGES.links + 1 }, (_, i) => ({ token: `${'C'.repeat(20)}${String(i).padStart(2, '0')}`, label: 'x' })) }, 'at most'],
  ])('rejects %j', (data, msg) => {
    expect(parsePageData(data).problem).toContain(msg)
  })

  it('never quotes the page text in a problem', () => {
    const secret = 'Acme Corp hiring'
    const p = parsePageData({ title: secret, description: 7, links: [{ token: T1, label: secret }] }).problem!
    expect(p).not.toContain(secret)
  })

  it('checks file names', () => {
    expect(pageIdProblem('acme-2026')).toBeNull()
    expect(pageIdProblem('Acme')).toBeTruthy()
    expect(pageIdProblem('a'.repeat(61))).toBeTruthy()
  })

  it('runs the post body rules and the dash rule', () => {
    const body = `A ${String.fromCharCode(0x2014)} dash`
    const raw = `---\ntitle: x\nlinks:\n  - token: ${T1}\n    label: y\n---\n\n${body}\n`
    expect(pageProblems(raw, { title: 'x', links: [{ token: T1, label: 'y' }] }, body).some((p) => p.includes('dash'))).toBe(true)
  })

  it('finds tokens shared by two pages', () => {
    expect(pageTokenClashes([{ id: 'a', page: page() }, { id: 'b', page: page() }])).toHaveLength(1)
    expect(pageTokenClashes([{ id: 'a', page: page() }, { id: 'b', page: page({ links: [{ token: T2, label: '' }] }) }])).toEqual([])
  })
})

describe('link lifetime', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  it('is open with no end, until the earlier expiry (inclusive), never when disabled or revoked', () => {
    expect(linkUntil(page(), page().links[0])).toBe('')
    expect(linkUntil(page({ expires: '2026-12-01' }), { token: T1, label: '', expires: '2026-11-20' })).toBe('2026-11-20')
    expect(linkUntil(page({ expires: '2026-11-15' }), { token: T1, label: '', expires: '2026-11-20' })).toBe('2026-11-15')
    expect(linkUntil(page({ disabled: true }), page().links[0])).toBeNull()
    expect(linkUntil(page(), { token: T1, label: '', revoked: true })).toBeNull()
    expect(linkOpen('', now)).toBe(true)
    expect(linkOpen('2026-11-13', now)).toBe(true)
    expect(linkOpen('2026-11-12', now)).toBe(false)
    expect(linkOpen(null, now)).toBe(false)
  })
})

describe('page files', () => {
  it('round-trips through serialize and parse', () => {
    const p = page({ description: 'A note: with "quotes"', date: '2026-11-13', expires: '2027-01-31', links: [{ token: T1, label: 'A' }, { token: T2, label: 'B: two', expires: '2026-12-01', revoked: true }] })
    const raw = serializePage(p, '# Hello\n\nBody text.')
    const r = parsePage(raw, 'acme')
    expect(r.problems).toEqual([])
    expect(r.file?.page).toEqual(p)
    expect(r.file?.body).toBe('# Hello\n\nBody text.')
  })

  it('reports problems without a file', () => {
    expect(parsePage('---\ntitle: x\n---\n', 'acme').problems.length).toBeGreaterThan(0)
    expect(parsePage('---\ntitle: x\n---\n', 'Bad Name').problems.length).toBeGreaterThan(0)
  })

  it('makes 22-character base64url tokens that pass the rules', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(newToken())
    expect(seen.size).toBe(200)
    for (const t of seen) expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(pageUrl(T1)).toBe(`https://michal.ai/p/${T1}`)
  })
})

describe('build manifest', () => {
  it('keys a page by a hash that says nothing about its id or tokens, and changes with its links', () => {
    const k = pageKey('acme', page())
    expect(k).toMatch(/^[0-9a-f]{24}$/)
    expect(k).not.toContain('acme')
    expect(pageKey('acme', page({ links: [{ token: T2, label: '' }] }))).not.toBe(k)
  })

  it('maps open links to their page and leaves out disabled pages and revoked links', () => {
    const pages = [
      { id: 'a', key: 'ka', body: '', page: page({ links: [{ token: T1, label: '' }, { token: T2, label: '', revoked: true }] }) },
      { id: 'b', key: 'kb', body: '', page: page({ disabled: true, links: [{ token: 'D'.repeat(22), label: '' }] }) },
      { id: 'c', key: 'kc', body: '', page: page({ expires: '2027-01-01', links: [{ token: 'E'.repeat(22), label: '' }] }) },
    ]
    expect(pagesManifest(pages)).toEqual({
      links: { [T1]: { page: 'a', key: 'ka', until: '' }, ['E'.repeat(22)]: { page: 'c', key: 'kc', until: '2027-01-01' } },
      pages: ['a', 'b', 'c'],
    })
  })
})
