import { describe, expect, it } from 'vitest'
import { INTERVAL, RESUME_DELAY, canAutoAdvance, initialRotation, isPaused, rotationReducer } from '../rotation'

// The hero's work line must start rotating by itself after hydration, whatever order the mount-time events arrive in
// (IntersectionObserver reports "visible", visibility is "visible", reduced motion is off). A stuck pause would freeze
// the hero's centerpiece, so these sequences are pinned.
describe('work line starts rotating after mount', () => {
  it('mount-time resume events never leave it paused', () => {
    let s = initialRotation(7)
    s = rotationReducer(s, { type: 'reduced', value: false })
    s = rotationReducer(s, { type: 'resume', reason: 'offscreen', now: 10 })
    s = rotationReducer(s, { type: 'resume', reason: 'hidden', now: 10 })
    expect(isPaused(s)).toBe(false)
    expect(s.reduced).toBe(false)
  })
  it('advances on the first tick after the quiet period', () => {
    let s = initialRotation(7)
    s = rotationReducer(s, { type: 'resume', reason: 'offscreen', now: 100 })
    expect(canAutoAdvance(s, 0)).toBe(true) // a resume that was never paused is a no-op: no quiet period is invented
    expect(canAutoAdvance(s, 100 + INTERVAL)).toBe(true)
    s = rotationReducer(s, { type: 'tick', now: 100 + INTERVAL })
    expect(s.index).toBe(1)
    expect(s.phase).toBe('rolling')
  })
  it('hover and focus pause it and resuming restarts the clock', () => {
    let s = initialRotation(7)
    s = rotationReducer(s, { type: 'pause', reason: 'hover' })
    expect(rotationReducer(s, { type: 'tick', now: 99999 }).index).toBe(0)
    s = rotationReducer(s, { type: 'resume', reason: 'hover', now: 1000 })
    expect(isPaused(s)).toBe(false)
    expect(rotationReducer(s, { type: 'tick', now: 1000 + RESUME_DELAY + 1 }).index).toBe(1)
  })
  it('never advances under reduced motion', () => {
    const s = rotationReducer(initialRotation(7), { type: 'reduced', value: true })
    expect(rotationReducer(s, { type: 'tick', now: 99999 }).index).toBe(0)
  })
})
