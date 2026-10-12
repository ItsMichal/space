import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { hackathons, hackathonRegistrationsOnly, devpostProfileUrl } from '@/content/hackathons'
import { press } from '@/content/press'

// Built from parts so this file does not itself contain the handle the identity check looks for.
const HANDLE = new RegExp(['hal', 'mic'].join(''), 'i')
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const KINDS = ['news', 'award', 'expo', 'lab', 'other']

const urlsIn = (v: unknown): string[] => {
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? [v] : []
  if (Array.isArray(v)) return v.flatMap(urlsIn)
  if (v && typeof v === 'object') return Object.values(v).flatMap(urlsIn)
  return []
}

describe('hackathons data', () => {
  it('has unique ids and ISO-month dates, newest first', () => {
    const ids = hackathons.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const h of hackathons) expect(h.date).toMatch(ISO_MONTH)
    const dates = hackathons.map((h) => h.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('has required fields and https URLs only', () => {
    for (const h of hackathons) {
      expect(h.event && h.project && h.organiser).toBeTruthy()
      expect(h.eventUrl).toMatch(/^https:\/\//)
      expect(h.sources.length).toBeGreaterThan(0)
      expect(Array.isArray(h.awards)).toBe(true)
      for (const u of urlsIn(h)) expect(u).toMatch(/^https:\/\//)
      if (h.projectUrl) expect(h.projectUrl).toMatch(/^https:\/\/devpost\.com\/software\//)
    }
    for (const r of hackathonRegistrationsOnly) {
      expect(r.date).toMatch(ISO_MONTH)
      for (const u of urlsIn(r)) expect(u).toMatch(/^https:\/\//)
    }
    expect(devpostProfileUrl).toMatch(/^https:\/\/devpost\.com\//)
  })
})

describe('press data', () => {
  it('has unique ids and valid dates', () => {
    const ids = press.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of press) {
      if (p.date === null) expect(p.dateNote).toBeTruthy()
      else expect(p.date).toMatch(ISO_DAY)
    }
  })

  it('has required fields, known kinds, https URLs and short neutral mentions', () => {
    for (const p of press) {
      expect(p.outlet && p.title && p.identityEvidence).toBeTruthy()
      expect(KINDS).toContain(p.kind)
      expect(p.presence.length).toBeGreaterThan(0)
      expect(p.sources.length).toBeGreaterThan(0)
      expect(p.mention.split(/\s+/).length).toBeLessThanOrEqual(15)
      for (const u of urlsIn(p)) expect(u).toMatch(/^https:\/\//)
      if (p.archiveUrl) expect(p.archiveUrl).toMatch(/^https:\/\/web\.archive\.org\//)
      expect(p.isCuBoulder).toBe(new URL(p.url).hostname.endsWith('colorado.edu'))
    }
  })
})

describe('identity rule', () => {
  it('data and source files do not contain the casual handle', () => {
    expect(JSON.stringify([hackathons, hackathonRegistrationsOnly, press])).not.toMatch(HANDLE)
    for (const f of ['hackathons.ts', 'press.ts']) {
      const src = readFileSync(path.resolve(__dirname, '../../content', f), 'utf8')
      expect(src).not.toMatch(HANDLE)
    }
  })
})
