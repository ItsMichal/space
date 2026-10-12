import { describe, expect, it } from 'vitest'
import { getAllPosts, getMainProjects, getTopLevel } from '@/lib/content'
import { parsePost, serializePost } from '@/lib/content/serialize'
import { getMenuPreviews } from '@/lib/menu'
import { hackathons } from '@/content/hackathons'
import { press } from '@/content/press'

const MINOR = [
  'airplane-game',
  'askawai',
  'creatle',
  'grocerybot',
  'intro-to-web-dev',
  'ohisee',
  'pilsudski',
  'playsafe',
  'sea-of-thoughts',
]

describe('minor projects (short write-ups for public repos)', () => {
  const all = getAllPosts()
  const minor = all.filter((p) => p.minor)

  it('are top-level projects that stay out of the hero rotation and out of the featured slots', () => {
    expect(minor.map((p) => p.slug).sort()).toEqual(MINOR)
    for (const p of minor) {
      expect(p.kind, p.slug).toBe('project')
      expect(p.parent, p.slug).toBeUndefined()
      expect(p.hook, p.slug).toBeUndefined()
      expect(p.featured, p.slug).toBeUndefined()
      expect(p.priority, p.slug).toBeUndefined()
    }
  })

  it('are listed on /projects after every main project', () => {
    const slugs = getTopLevel('project').map((p) => p.slug)
    const firstMinor = slugs.findIndex((s) => MINOR.includes(s))
    expect(firstMinor).toBeGreaterThan(0)
    expect(slugs.slice(firstMinor).every((s) => MINOR.includes(s))).toBe(true)
    expect(slugs.slice(0, firstMinor).some((s) => MINOR.includes(s))).toBe(false)
    expect(MINOR.every((s) => slugs.includes(s))).toBe(true)
  })

  it('are newest first among themselves', () => {
    const dates = getTopLevel('project')
      .filter((p) => p.minor)
      .map((p) => p.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('are not in the home page selection or the menu previews', () => {
    const main = getMainProjects().map((p) => p.slug)
    expect(main.length).toBeGreaterThan(0)
    for (const s of MINOR) expect(main).not.toContain(s)
    const work = getMenuPreviews().work.map((w) => w.href)
    for (const s of MINOR) expect(work).not.toContain(`/projects/${s}`)
  })

  it('keep the hero rotation unchanged (no minor project has a hook)', () => {
    expect(all.filter((p) => p.hook && p.minor)).toEqual([])
    expect(all.filter((p) => p.hook).length).toBeGreaterThanOrEqual(7)
  })

  it('survive a parse/serialize round trip', () => {
    const p = minor[0]
    const again = parsePost(serializePost(p, 'x'), p.slug).frontmatter
    expect(again.minor).toBe(true)
    expect(parsePost(serializePost({ ...p, minor: undefined }, 'x'), p.slug).frontmatter.minor).toBeUndefined()
  })

  it('contain no em or en dashes in their text or links', () => {
    for (const p of minor) {
      expect(JSON.stringify([p.title, p.description, p.role, p.years, p.links, p.body]), p.slug).not.toMatch(/[–—]/)
    }
  })

  it('are the posts that hackathon and press records point at', () => {
    const slugs = new Set(all.map((p) => p.slug))
    for (const r of [...hackathons, ...press]) if (r.relatedPostSlug) expect(slugs.has(r.relatedPostSlug), r.id).toBe(true)
    expect(hackathons.find((h) => h.id === 'hackcu-8-creatle')?.relatedPostSlug).toBe('creatle')
    expect(press.find((p) => p.id === 'denver-post-2017-kaiser')?.relatedPostSlug).toBe('pilsudski')
  })
})
