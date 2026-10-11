// Pure state machine for the hero's rotating "I've built ..." line. No DOM, no timers: the component feeds it events
// and reads the result, so pause/resume, manual stepping and click resolution are unit-testable.
//
// Model: `index` is the phrase being shown (or arriving). While `phase` is 'rolling' the previous phrase (`prev`) is still
// leaving. A click or Enter always follows `index` (the incoming phrase), never `prev`.

export type PauseReason = 'hover' | 'focus' | 'hidden' | 'offscreen' | 'drag'

export type RotationState = {
  count: number
  index: number
  prev: number | null
  /** +1: content moves up (next), -1: content moves down (previous). */
  dir: 1 | -1
  phase: 'idle' | 'rolling'
  paused: PauseReason[]
  /** Auto-rotation stays quiet until this time (ms, same clock as the `now` passed to events). */
  quietUntil: number
  /** Reduced motion: no automatic rotation at all, steps are manual and crossfade only. */
  reduced: boolean
}

export type RotationAction =
  | { type: 'tick'; now: number }
  | { type: 'step'; dir: 1 | -1; now: number }
  | { type: 'settled' }
  | { type: 'pause'; reason: PauseReason }
  | { type: 'resume'; reason: PauseReason; now: number }
  | { type: 'reduced'; value: boolean }

/** How long after the last interaction before auto-rotation may continue. */
export const RESUME_DELAY = 3500
/** Time between automatic changes. */
export const INTERVAL = 4800
/** Duration of one roll (ms), matches the CSS. */
export const ROLL_MS = 700

export const initialRotation = (count: number, reduced = false): RotationState => ({
  count,
  index: 0,
  prev: null,
  dir: 1,
  phase: 'idle',
  paused: [],
  quietUntil: 0,
  reduced,
})

const wrap = (i: number, n: number) => ((i % n) + n) % n

export function isPaused(s: RotationState): boolean {
  return s.paused.length > 0
}

/** True when an automatic tick at `now` would advance. */
export function canAutoAdvance(s: RotationState, now: number): boolean {
  return s.count > 1 && !s.reduced && !isPaused(s) && now >= s.quietUntil
}

export function rotationReducer(s: RotationState, a: RotationAction): RotationState {
  switch (a.type) {
    case 'tick':
      return canAutoAdvance(s, a.now) ? advance(s, 1) : s
    case 'step':
      // Manual steps are always allowed, even mid-roll (the incoming phrase becomes the leaving one) and hold off auto-rotation.
      return { ...advance(s, a.dir), quietUntil: a.now + RESUME_DELAY }
    case 'settled':
      return s.phase === 'rolling' ? { ...s, phase: 'idle', prev: null } : s
    case 'pause':
      return s.paused.includes(a.reason) ? s : { ...s, paused: [...s.paused, a.reason] }
    case 'resume':
      return s.paused.includes(a.reason)
        ? { ...s, paused: s.paused.filter((r) => r !== a.reason), quietUntil: Math.max(s.quietUntil, a.now + RESUME_DELAY) }
        : s
    case 'reduced':
      return a.value === s.reduced ? s : { ...s, reduced: a.value }
  }
}

function advance(s: RotationState, dir: 1 | -1): RotationState {
  if (s.count < 2) return s
  return { ...s, prev: s.index, index: wrap(s.index + dir, s.count), dir, phase: 'rolling' }
}

/** Index of the phrase a click or Enter should follow right now: always the incoming (current) one. */
export const clickTarget = (s: RotationState): number => s.index

/** Visual position of phrase `i`: 0 shown, -1 above (left upward), +1 below (waiting / left downward). */
export function slotOf(s: RotationState, i: number): -1 | 0 | 1 {
  if (i === s.index) return 0
  if (i === s.prev) return s.dir === 1 ? -1 : 1
  return s.dir === 1 ? 1 : -1
}
