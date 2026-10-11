import { describe, expect, it } from 'vitest'
import { canAutoAdvance, clickTarget, initialRotation, RESUME_DELAY, rotationReducer as r, slotOf } from '../rotation'

describe('rotation state machine', () => {
  it('auto-advances on tick and wraps', () => {
    let s = initialRotation(3)
    s = r(s, { type: 'tick', now: 5000 })
    expect([s.index, s.prev, s.phase]).toEqual([1, 0, 'rolling'])
    s = r(s, { type: 'settled' })
    s = r(r(s, { type: 'tick', now: 10000 }), { type: 'settled' })
    s = r(s, { type: 'tick', now: 15000 })
    expect(s.index).toBe(0)
  })

  it('does not advance while paused, and resumes only after the quiet delay', () => {
    let s = initialRotation(3)
    s = r(s, { type: 'pause', reason: 'hover' })
    expect(r(s, { type: 'tick', now: 9999 })).toBe(s)
    s = r(s, { type: 'resume', reason: 'hover', now: 10000 })
    expect(canAutoAdvance(s, 10000 + RESUME_DELAY - 1)).toBe(false)
    expect(canAutoAdvance(s, 10000 + RESUME_DELAY)).toBe(true)
  })

  it('stays paused while any reason remains', () => {
    let s = initialRotation(3)
    s = r(r(s, { type: 'pause', reason: 'hover' }), { type: 'pause', reason: 'hidden' })
    s = r(s, { type: 'resume', reason: 'hover', now: 0 })
    expect(canAutoAdvance(s, 1e9)).toBe(false)
    s = r(s, { type: 'resume', reason: 'hidden', now: 0 })
    expect(canAutoAdvance(s, 1e9)).toBe(true)
  })

  it('manual steps work even when paused, go both ways, and hold off auto-rotation', () => {
    let s = r(initialRotation(4), { type: 'pause', reason: 'focus' })
    s = r(s, { type: 'step', dir: -1, now: 100 })
    expect(s.index).toBe(3)
    expect(s.dir).toBe(-1)
    s = r(s, { type: 'resume', reason: 'focus', now: 100 })
    expect(canAutoAdvance(s, 100 + RESUME_DELAY - 1)).toBe(false)
  })

  it('a click during a transition resolves to the incoming phrase, never the leaving one', () => {
    let s = initialRotation(3)
    s = r(s, { type: 'tick', now: 5000 })
    expect(s.phase).toBe('rolling')
    expect(clickTarget(s)).toBe(1)
    expect(s.prev).toBe(0)
    // stepping again mid-roll: the incoming becomes the leaving one and the new target is the next phrase
    s = r(s, { type: 'step', dir: 1, now: 5100 })
    expect(clickTarget(s)).toBe(2)
    expect(s.prev).toBe(1)
  })

  it('places phrases above, in, or below the window depending on direction', () => {
    let s = r(initialRotation(3), { type: 'step', dir: 1, now: 0 })
    expect([slotOf(s, 1), slotOf(s, 0), slotOf(s, 2)]).toEqual([0, -1, 1])
    s = r(initialRotation(3), { type: 'step', dir: -1, now: 0 })
    expect([slotOf(s, 2), slotOf(s, 0), slotOf(s, 1)]).toEqual([0, 1, -1])
  })

  it('never auto-rotates under reduced motion, and a single phrase never moves', () => {
    const reduced = initialRotation(3, true)
    expect(r(reduced, { type: 'tick', now: 1e9 })).toBe(reduced)
    expect(r(initialRotation(1), { type: 'step', dir: 1, now: 0 }).index).toBe(0)
  })
})
