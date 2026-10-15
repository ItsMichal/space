import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { paperMentions } from '@/content/mentions'

// Built from parts so this file does not itself contain the handle the identity check looks for.
const HANDLE = new RegExp(['hal', 'mic'].join(''), 'i')
const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const KINDS = ['acknowledgment', 'system-credit', 'contributor-statement', 'other']
const words = (s: string) => s.trim().split(/\s+/).length
const normalise = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const postIds = new Set(
  readdirSync(path.resolve(__dirname, '../../content/posts'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(path.resolve(__dirname, '../../content/posts', f), 'utf8').match(/^id:\s*(.+)$/m)?.[1]?.trim())
    .filter(Boolean) as string[]
)

const urlsIn = (v: unknown): string[] => {
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? [v] : []
  if (Array.isArray(v)) return v.flatMap(urlsIn)
  if (v && typeof v === 'object') return Object.values(v).flatMap(urlsIn)
  return []
}

describe('paperMentions data', () => {
  it('has unique ids and ISO publication dates', () => {
    const ids = paperMentions.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of paperMentions) {
      expect(m.published).toMatch(ISO_DAY)
      expect(m.year).toMatch(/^\d{4}$/)
    }
  })

  it('has required fields, known kinds and https URLs only', () => {
    for (const m of paperMentions) {
      expect(m.title && m.venue && m.venueShort && m.identityEvidence).toBeTruthy()
      expect(m.authors.length).toBeGreaterThan(0)
      expect(KINDS).toContain(m.mentionKind)
      expect(m.sources.length).toBeGreaterThan(0)
      for (const u of urlsIn(m)) expect(u).toMatch(/^https:\/\//)
      if (m.doi) expect(m.doi).toMatch(/^10\.\d{4,9}\/\S+$/)
    }
  })

  it('quotes name him, stay short, and the paper does not list him as an author', () => {
    for (const m of paperMentions) {
      expect(normalise(m.quote)).toContain('bodzianowski')
      expect(words(m.quote)).toBeLessThan(25)
      expect(words(m.note)).toBeLessThanOrEqual(15)
      expect(m.authors.some((a) => normalise(a).includes('bodzianowski'))).toBe(false)
    }
  })

  it('links only to real post ids', () => {
    for (const m of paperMentions) if (m.relatedPostId) expect(postIds.has(m.relatedPostId)).toBe(true)
  })

  it('does not contain the casual handle', () => {
    expect(JSON.stringify(paperMentions)).not.toMatch(HANDLE)
    expect(readFileSync(path.resolve(__dirname, '../../content/mentions.ts'), 'utf8')).not.toMatch(HANDLE)
  })
})
