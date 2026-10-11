// Live-tunable backdrop settings. Defaults are the shipped look; the dev route /shaders mutates them.
export type BackdropSettings = {
  enabled: boolean
  /** Overall strength of the blooms, 0..1.5 */
  intensity: number
  /** Out-of-focus amount, 0..1.5 */
  blur: number
  /** How much of the page the blooms may occupy (size and feather), 0..1.5 */
  coverage: number
  /** Wind sway amplitude, 0..2 */
  sway: number
  /** Show the quiet zones as a debug tint */
  debugZones: boolean
}

export const BACKDROP_DEFAULTS: BackdropSettings = {
  enabled: true,
  intensity: 1,
  blur: 1,
  coverage: 1,
  sway: 1,
  debugZones: false,
}

const state: BackdropSettings = { ...BACKDROP_DEFAULTS }
const listeners = new Set<() => void>()

export const getBackdrop = () => state
export const setBackdrop = (patch: Partial<BackdropSettings>) => {
  Object.assign(state, patch)
  listeners.forEach((l) => l())
}
export const onBackdropChange = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
