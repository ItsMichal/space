// Handwriting playback as a pure function of time. Strokes play in recorded order at the recorded pen pace, scaled to the
// duration; each one comes into focus while and after it is drawn: blur and RGB split shrink to zero, opacity rises. The player
// calls frameAt() from one animation frame loop (and the editor's tuner scrubs it), so any moment can be shown exactly.
import { HANDWRITING, handwritingNumber } from '@/lib/content/rules.mjs'
import { PACE_STEPS, type BuiltInk } from './geometry'

export type InkEase = 'out' | 'in-out' | 'linear' | 'expo'
export type InkColor = 'ink' | 'accent'

export type InkSettings = {
  /** Seconds the pen takes to write everything; null keeps the recorded pace (clamped to a sensible length). */
  duration: number | null
  /** Starting blur, screen px. */
  blur: number
  /** Starting RGB split, screen px. */
  chroma: number
  /** Multiplier on the recorded pauses between strokes. */
  stagger: number
  /** Seconds a stroke takes to come into focus, from its first point. */
  focus: number
  ease: InkEase
}

export const INK_DEFAULTS: InkSettings = { duration: null, blur: 6, chroma: 2.5, stagger: 1, focus: 1.2, ease: 'out' }

export const INK_PRESETS: Record<'Subtle' | 'Signature' | 'Dramatic', InkSettings> = {
  Subtle: { duration: null, blur: 3, chroma: 1, stagger: 0.6, focus: 0.6, ease: 'out' },
  Signature: INK_DEFAULTS,
  Dramatic: { duration: null, blur: 14, chroma: 6, stagger: 1.4, focus: 2.6, ease: 'expo' },
}

/** Settings from directive attributes (already allowlisted by the renderer; clamped again here). */
export function inkSettings(attrs: Partial<Record<'duration' | 'blur' | 'chroma' | 'stagger' | 'focus' | 'ease', unknown>>): InkSettings {
  const num = (k: 'duration' | 'blur' | 'chroma' | 'stagger' | 'focus') => {
    const v = handwritingNumber(k, typeof attrs[k] === 'number' ? String(attrs[k]) : attrs[k])
    return v === null ? null : Number(v)
  }
  const ease = HANDWRITING.ease.includes(String(attrs.ease)) ? (attrs.ease as InkEase) : INK_DEFAULTS.ease
  return {
    duration: num('duration'),
    blur: num('blur') ?? INK_DEFAULTS.blur,
    chroma: num('chroma') ?? INK_DEFAULTS.chroma,
    stagger: num('stagger') ?? INK_DEFAULTS.stagger,
    focus: num('focus') ?? INK_DEFAULTS.focus,
    ease,
  }
}

/** The directive attributes for settings (only the ones that differ from the defaults, so the markdown stays short). */
export function inkAttrs(s: InkSettings): Record<string, string> {
  const out: Record<string, string> = {}
  if (s.duration !== null) out.duration = String(Math.round(s.duration * 100) / 100)
  for (const k of ['blur', 'chroma', 'stagger', 'focus'] as const) if (s[k] !== INK_DEFAULTS[k]) out[k] = String(Math.round(s[k] * 100) / 100)
  if (s.ease !== INK_DEFAULTS.ease) out.ease = s.ease
  return out
}

const EASES: Record<InkEase, (p: number) => number> = {
  linear: (p) => p,
  out: (p) => 1 - (1 - p) ** 3,
  'in-out': (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  expo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
}

/** When each stroke plays, in ms of playback: it starts, finishes drawing, and is fully in focus. */
export type Slot = { start: number; drawn: number; end: number }
export type Schedule = { slots: Slot[]; total: number }

const MIN_DRAW = 40
const MAX_GAP = 1200
const AUTO = [600, 10000]

export function schedule(ink: BuiltInk, s: InkSettings): Schedule {
  const draws = ink.strokes.map((k) => Math.max(MIN_DRAW, k.t1 - k.t0))
  const gaps = ink.strokes.map((k, i) => (i === 0 ? 0 : Math.min(MAX_GAP, Math.max(0, k.t0 - ink.strokes[i - 1].t1)) * s.stagger))
  const natural = draws.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)
  const target = s.duration !== null ? s.duration * 1000 : Math.min(AUTO[1], Math.max(AUTO[0], natural))
  const k = natural > 0 ? target / natural : 1
  const slots: Slot[] = []
  let at = 0
  let total = 0
  for (let i = 0; i < draws.length; i++) {
    at += gaps[i] * k
    const drawn = at + draws[i] * k
    const end = at + Math.max(draws[i] * k, s.focus * 1000)
    slots.push({ start: at, drawn, end })
    total = Math.max(total, end)
    at = drawn
  }
  return { slots, total }
}

export type StrokeFrame = { visible: boolean; reveal: number; blur: number; chroma: number; opacity: number; settled: boolean }

const HIDDEN: StrokeFrame = { visible: false, reveal: 0, blur: 0, chroma: 0, opacity: 0, settled: false }
const SETTLED: StrokeFrame = { visible: true, reveal: 1, blur: 0, chroma: 0, opacity: 1, settled: true }

/** One stroke at playback time t (ms). */
export function frameAt(ink: BuiltInk, plan: Schedule, s: InkSettings, i: number, t: number): StrokeFrame {
  const slot = plan.slots[i]
  if (t < slot.start) return HIDDEN
  if (t >= slot.end) return SETTLED
  const u = slot.drawn > slot.start ? Math.min(1, (t - slot.start) / (slot.drawn - slot.start)) : 1
  const pace = ink.strokes[i].pace
  const x = u * PACE_STEPS
  const lo = Math.floor(x)
  const reveal = lo >= PACE_STEPS ? 1 : pace[lo] + (pace[lo + 1] - pace[lo]) * (x - lo)
  const e = EASES[s.ease](Math.min(1, (t - slot.start) / (slot.end - slot.start)))
  return { visible: true, reveal, blur: s.blur * (1 - e), chroma: s.chroma * (1 - e), opacity: 0.2 + 0.8 * Math.min(1, e * 1.6), settled: false }
}
