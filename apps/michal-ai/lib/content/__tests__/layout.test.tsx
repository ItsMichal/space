// The layout file (card order and presentation) is untrusted input like a post: the hosted editor and pull requests to
// space-content write it. The schema is fed hostile input here; the ordering helpers and the validator's cross-checks follow.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LAYOUT, layoutProblem, layoutRefProblems, parseLayout } from '../rules.mjs'
import { cardOf, heroHooks, homeWork, indexWork, isFeature, pinned, siteLayout, type SiteLayout } from '../layout'
import { getAllPosts, getMainProjects, getProjectIndex, getTopLevel } from '@/lib/content'
import { Showcase } from '@/components/work/Showcase'

const enc = (v: unknown) => new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v))
const ok = { version: 1, work: ['starlink', 'jia-webapp'], writing: ['taco-neko-development'], hooks: ['order-flow'], cards: { starlink: { size: 'feature', variant: 'cap', focus: '50% 30%', home: true } } }

describe('layout file schema', () => {
  it('accepts a full layout and returns only the checked fields', () => {
    const r = parseLayout(enc(ok))
    expect(r.problem).toBeUndefined()
    expect(r.layout).toEqual(ok)
    expect(parseLayout('{"version":1}').layout).toEqual({ version: 1 })
  })

  it('accepts the committed layout file', () => {
    expect(layoutProblem(enc(fs.readFileSync(path.join(process.cwd(), 'content', 'layout.json'), 'utf8')))).toBeNull()
  })

  it.each<[string, unknown]>([
    ['empty', ''],
    ['not JSON', '{version: 1}'],
    ['array root', '[1]'],
    ['null root', 'null'],
    ['string root', '"x"'],
    ['missing version', { work: [] }],
    ['version 2', { version: 2 }],
    ['version as string', { version: '1' }],
    ['unknown top-level key', { version: 1, theme: 'dark' }],
    ['__proto__ key', '{"version":1,"__proto__":{"polluted":1}}'],
    ['constructor key', '{"version":1,"constructor":{"prototype":{"polluted":1}}}'],
    ['work not a list', { version: 1, work: 'starlink' }],
    ['work as object', { version: 1, work: { 0: 'starlink' } }],
    ['number in work', { version: 1, work: [1] }],
    ['null in work', { version: 1, work: [null] }],
    ['nested list in hooks', { version: 1, hooks: [['a']] }],
    ['path traversal slug', { version: 1, work: ['../../etc/passwd'] }],
    ['slash in slug', { version: 1, work: ['posts/starlink'] }],
    ['upper case slug', { version: 1, writing: ['Starlink'] }],
    ['html in slug', { version: 1, work: ['<img src=x onerror=alert(1)>'] }],
    ['javascript: url slug', { version: 1, work: ['javascript:alert(1)'] }],
    ['very long slug', { version: 1, work: ['a'.repeat(81)] }],
    ['duplicate slug', { version: 1, work: ['starlink', 'starlink'] }],
    ['too many entries', { version: 1, work: Array.from({ length: LAYOUT.list + 1 }, (_, i) => `p${i}`) }],
    ['cards as list', { version: 1, cards: [{ size: 'feature' }] }],
    ['cards key not a slug', { version: 1, cards: { 'Star Link': {} } }],
    ['cards __proto__ key', '{"version":1,"cards":{"__proto__":{"size":"feature"}}}'],
    ['card as string', { version: 1, cards: { starlink: 'feature' } }],
    ['card unknown key', { version: 1, cards: { starlink: { className: 'x' } } }],
    ['card style key', { version: 1, cards: { starlink: { style: 'background:url(javascript:alert(1))' } } }],
    ['size outside the enum', { version: 1, cards: { starlink: { size: 'huge' } } }],
    ['variant outside the enum', { version: 1, cards: { starlink: { variant: 'tile--feature" onclick="x' } } }],
    ['focus with css injection', { version: 1, cards: { starlink: { focus: '50% 50%; background:url(//evil)' } } }],
    ['focus over 100', { version: 1, cards: { starlink: { focus: '101% 0%' } } }],
    ['negative focus', { version: 1, cards: { starlink: { focus: '-5% 0%' } } }],
    ['decimal focus', { version: 1, cards: { starlink: { focus: '50.5% 0%' } } }],
    ['focus keywords', { version: 1, cards: { starlink: { focus: 'center top' } } }],
    ['focus as numbers', { version: 1, cards: { starlink: { focus: [50, 30] } } }],
    ['home as string', { version: 1, cards: { starlink: { home: 'false' } } }],
    ['home as number', { version: 1, cards: { starlink: { home: 0 } } }],
    ['too many cards', { version: 1, cards: Object.fromEntries(Array.from({ length: LAYOUT.cards + 1 }, (_, i) => [`p${i}`, {}])) }],
    ['non-ASCII', '{"version":1,"work":["star​link"]}'],
    ['escaped non-ASCII', '{"version":1,"work":["star\\u0000link"]}'],
    ['too large', `{"version":1,"work":[${'"a",'.repeat(LAYOUT.bytes / 4)}"b"]}`],
  ])('refuses %s', (_, doc) => {
    expect(layoutProblem(enc(doc))).toBeTruthy()
    expect(layoutProblem(typeof doc === 'string' ? doc : JSON.stringify(doc))).toBeTruthy()
  })

  it('refuses invalid UTF-8 and control bytes', () => {
    expect(layoutProblem(new Uint8Array([0x7b, 0xff, 0x7d]))).toBeTruthy()
    expect(layoutProblem(new Uint8Array([...enc('{"version":1}'), 0x00]))).toBeTruthy()
  })

  it('never pollutes Object.prototype', () => {
    parseLayout('{"version":1,"__proto__":{"polluted":1},"cards":{"__proto__":{"polluted":1}}}')
    expect(({} as { polluted?: number }).polluted).toBeUndefined()
  })
})

describe('layout references', () => {
  const posts = [
    { slug: 'starlink', kind: 'project' },
    { slug: 'order-flow', kind: 'project', parent: 'starlink', hook: 'the order flow' },
    { slug: 'essay', kind: 'article' },
    { slug: 'log', kind: 'article', parent: 'starlink' },
  ]
  it('passes slugs that point at the right kind of post', () => {
    expect(layoutRefProblems({ version: 1, work: ['starlink'], writing: ['essay'], hooks: ['order-flow'], cards: { starlink: {} } }, posts)).toEqual([])
  })
  it('flags stale and wrong-kind slugs', () => {
    const p = layoutRefProblems({ version: 1, work: ['gone', 'order-flow', 'essay'], writing: ['log', 'starlink'], hooks: ['starlink'], cards: { essay: {} } }, posts)
    expect(p).toEqual([
      'work: no post "gone"',
      'work: "order-flow" is not a top-level project',
      'work: "essay" is not a top-level project',
      'writing: "log" is not a top-level article',
      'writing: "starlink" is not a top-level article',
      'hooks: "starlink" is not a post with a hook',
      'cards: "essay" is not a top-level project',
    ])
  })
})

describe('ordering', () => {
  const items = ['a', 'b', 'c', 'd'].map((slug) => ({ slug }))
  it('puts pins first in pin order and keeps the rest in their order', () => {
    expect(pinned(items, ['c', 'a']).map((p) => p.slug)).toEqual(['c', 'a', 'b', 'd'])
    expect(pinned(items, ['zz']).map((p) => p.slug)).toEqual(['a', 'b', 'c', 'd'])
    expect(pinned(items).map((p) => p.slug)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('keeps home: false cards off the home page only', () => {
    const l: SiteLayout = { version: 1, work: ['c'], cards: { b: { home: false } } }
    expect(homeWork(items, l).map((p) => p.slug)).toEqual(['c', 'a', 'd'])
    expect(indexWork(items, l).map((p) => p.slug)).toEqual(['c', 'a', 'b', 'd'])
    expect(heroHooks(items, { version: 1, hooks: ['d'] }).map((p) => p.slug)).toEqual(['d', 'a', 'b', 'c'])
  })
  it('makes the first card the feature unless a size is set', () => {
    expect(isFeature({ slug: 'a' }, 0, { version: 1 })).toBe(true)
    expect(isFeature({ slug: 'b' }, 1, { version: 1 })).toBe(false)
    expect(isFeature({ slug: 'a' }, 0, { version: 1, cards: { a: { size: 'regular' } } })).toBe(false)
    expect(isFeature({ slug: 'b' }, 3, { version: 1, cards: { b: { size: 'feature' } } })).toBe(true)
    expect(cardOf('nope', { version: 1 })).toEqual({})
  })
})

describe('the site follows the layout file', () => {
  it('passes its own references', () => {
    const refs = getAllPosts({ includeDrafts: true }).map((p) => ({ slug: p.slug, kind: p.kind, parent: p.parent, hook: p.hook }))
    expect(layoutRefProblems(siteLayout, refs)).toEqual([])
  })
  it('leads Selected work, /projects and the hero line with Starlink.com', () => {
    expect(getMainProjects()[0].slug).toBe('starlink')
    expect(getProjectIndex()[0].slug).toBe('starlink')
    expect(getProjectIndex()).toHaveLength(getTopLevel('project').length)
    expect(heroHooks(getAllPosts().filter((p) => p.hook))[0].slug).toBe('order-flow')
  })
  it('renders size, variant and focus from a layout, and nothing else', () => {
    const posts = getMainProjects().slice(0, 3)
    const layout: SiteLayout = { version: 1, cards: { [posts[0].slug]: { size: 'regular' }, [posts[1].slug]: { size: 'feature', focus: '10% 90%' }, [posts[2].slug]: { variant: 'fill' } } }
    const html = renderToStaticMarkup(<Showcase posts={posts} base="/projects" layout={layout} />)
    const lis = html.split('<li').slice(1)
    expect(lis[0]).not.toContain('tiles__feature')
    expect(lis[1]).toContain('tiles__feature')
    expect(lis[2]).toContain('tile--fill')
    // only a feature entry carries a picture, so focus frames that one
    if (posts[1].cover || posts[1].cardImage) expect(lis[1]).toContain('10% 90%')
    expect(lis[2]).not.toContain('<img')
  })
})

describe('validate.mjs and the layout file', () => {
  const run = (layout: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'))
    fs.mkdirSync(path.join(dir, 'posts'))
    fs.mkdirSync(path.join(dir, 'media'))
    fs.mkdirSync(path.join(dir, 'site'))
    fs.writeFileSync(path.join(dir, 'posts', 'alpha.md'), '---\ntitle: Alpha\nslug: alpha\nkind: project\ndate: 2026-01-01\n---\nBody\n')
    fs.writeFileSync(path.join(dir, 'site', 'layout.json'), layout)
    const script = path.join(process.cwd(), 'scripts', 'content', 'validate.mjs')
    try {
      return { ok: true, out: execFileSync(process.execPath, [script, '--posts', 'posts', '--media', 'media'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' }) }
    } catch (e) {
      return { ok: false, out: String((e as { stderr?: string }).stderr) }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  it('checks site/layout.json in a space-content checkout', () => {
    expect(run('{"version":1,"work":["alpha"]}').ok).toBe(true)
    const stale = run('{"version":1,"work":["beta"]}')
    expect(stale.ok).toBe(false)
    expect(stale.out).toContain('no post "beta"')
    const bad = run('{"version":1,"work":["alpha"],"script":"x"}')
    expect(bad.ok).toBe(false)
    expect(bad.out).toContain('unknown key')
  })
})
