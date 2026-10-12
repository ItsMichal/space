import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryReactionStore, MemoryViewStore } from '../reactions-core'
import { isBotUserAgent, isSpeculative, parseViewBody, ID_RE } from '../validate'
import { alreadyCounted, scheduleView } from '../views'

const VID = 'abcdefghijklmnop1234'

describe('post id validation', () => {
  it('accepts slug-shaped ids only', () => {
    for (const ok of ['a', 'project-mountaintop', 'x1-2-3']) expect(ID_RE.test(ok)).toBe(true)
    for (const bad of ['', '-a', 'A', 'a b', 'a/b', '../x', 'a'.repeat(81), 'é']) expect(ID_RE.test(bad)).toBe(false)
  })
  it('view bodies: exactly {id, vid}, optionally checked against the live list', () => {
    expect(parseViewBody({ id: 'hello', vid: VID })).toEqual({ id: 'hello', vid: VID })
    expect(parseViewBody({ id: 'hello', vid: VID }, new Set(['other']))).toBeNull()
    expect(parseViewBody({ id: 'hello', vid: VID, x: 1 })).toBeNull()
    expect(parseViewBody({ id: 'hello', vid: 'short' })).toBeNull()
    expect(parseViewBody([])).toBeNull()
    expect(parseViewBody(null)).toBeNull()
  })
})

describe('bots and speculative loads', () => {
  it('flags crawlers, unfurlers, tools and empty user agents', () => {
    for (const ua of ['Googlebot/2.1', 'curl/8.4.0', 'python-requests/2.31', 'Slackbot-LinkExpanding 1.0', 'Mozilla/5.0 HeadlessChrome/130', '', null, 'x'])
      expect(isBotUserAgent(ua)).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(false)
  })
  it('flags prefetch and prerender purposes', () => {
    const h = (o: Record<string, string>) => (n: string) => o[n] ?? null
    expect(isSpeculative(h({ 'Sec-Purpose': 'prefetch' }))).toBe(true)
    expect(isSpeculative(h({ 'Sec-Purpose': 'prefetch;prerender' }))).toBe(true)
    expect(isSpeculative(h({ Purpose: 'prefetch' }))).toBe(true)
    expect(isSpeculative(h({}))).toBe(false)
  })
})

describe('view de-duplication semantics', () => {
  it('counts a visitor once per UTC day, and again the next day', () => {
    const v = new MemoryViewStore()
    expect([v.view('a', 'D1'), v.view('a', 'D1'), v.view('b', 'D1')]).toEqual([true, false, true])
    expect(v.view('a', 'D2')).toBe(true)
    expect(v.total).toBe(3)
  })
  it('caps how many visitors are remembered per day', () => {
    const v = new MemoryViewStore(2)
    expect([v.view('a', 'D'), v.view('b', 'D'), v.view('c', 'D')]).toEqual([true, true, false])
  })
})

describe('reaction toggle semantics', () => {
  it('is idempotent set semantics: one of each emoji per visitor, any number of emoji', () => {
    const s = new MemoryReactionStore()
    expect(s.set('post', 'heart', 'A', true)).toBe(true)
    expect(s.set('post', 'heart', 'A', true)).toBe(false)
    expect(s.set('post', 'fire', 'A', true)).toBe(true)
    expect(s.set('post', 'heart', 'B', true)).toBe(true)
    expect(s.counts().post).toEqual({ heart: 2, fire: 1 })
    expect(s.mine('A').post?.sort()).toEqual(['fire', 'heart'])
    expect(s.set('post', 'heart', 'A', false)).toBe(true)
    expect(s.set('post', 'heart', 'A', false)).toBe(false)
    expect(s.counts().post).toEqual({ heart: 1, fire: 1 })
  })
  it('caps rows', () => {
    const s = new MemoryReactionStore(2)
    expect([s.set('post', 'heart', 'A', true), s.set('post', 'heart', 'B', true), s.set('post', 'heart', 'C', true)]).toEqual([true, true, false])
  })
})

describe('client view scheduling', () => {
  let store: Record<string, string>
  beforeEach(() => {
    vi.useFakeTimers()
    store = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function fakeDoc(state: 'visible' | 'hidden' = 'visible', prerendering = false) {
    const l = new Map<string, Set<() => void>>()
    return {
      visibilityState: state as DocumentVisibilityState,
      prerendering,
      addEventListener: (t: string, f: () => void) => (l.get(t) ?? l.set(t, new Set()).get(t)!).add(f),
      removeEventListener: (t: string, f: () => void) => l.get(t)?.delete(f),
      fire: (t: string) => l.get(t)?.forEach((f) => f()),
    }
  }

  it('sends once after 5 s of visible time, and not again the same day', () => {
    const send = vi.fn()
    scheduleView('post-1', { doc: fakeDoc() as never, send, automated: false })
    vi.advanceTimersByTime(4900)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBe('post-1')
    expect(alreadyCounted('post-1')).toBe(true)
    scheduleView('post-1', { doc: fakeDoc() as never, send, automated: false })
    vi.advanceTimersByTime(10_000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('only counts time while the page is visible', () => {
    const send = vi.fn()
    const doc = fakeDoc()
    scheduleView('post-2', { doc: doc as never, send, automated: false })
    vi.advanceTimersByTime(3000)
    doc.visibilityState = 'hidden'
    doc.fire('visibilitychange')
    vi.advanceTimersByTime(60_000)
    expect(send).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    doc.fire('visibilitychange')
    vi.advanceTimersByTime(1900)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does nothing for prerender, hidden-from-the-start tabs, automation, or after cancel', () => {
    const send = vi.fn()
    scheduleView('p3', { doc: fakeDoc('visible', true) as never, send, automated: false })
    scheduleView('p4', { doc: fakeDoc('hidden') as never, send, automated: false })
    scheduleView('p5', { doc: fakeDoc() as never, send, automated: true })
    scheduleView('p6', { doc: fakeDoc() as never, send, automated: false })()
    vi.advanceTimersByTime(30_000)
    expect(send).not.toHaveBeenCalled()
  })
})
