/*
 * A narrow, additive seam so other layers (the glass engine) can sample the lidar field.
 *
 * The field canvas is a WebGL canvas without preserveDrawingBuffer, so its pixels are only readable
 * in the same task that drew them. LidarBackground calls `notifyLidarFrame()` right after each draw;
 * a listener may drawImage(canvas) synchronously. `requestLidarRedraw()` asks for one extra draw
 * (used when the field is a still frame under prefers-reduced-motion).
 */

type Source = { canvas: HTMLCanvasElement; redraw: () => void }

let source: Source | null = null
let listener: ((canvas: HTMLCanvasElement) => void) | null = null

export function registerLidarSource(next: Source | null): void {
  source = next
}

export function setLidarFrameListener(fn: ((canvas: HTMLCanvasElement) => void) | null): void {
  listener = fn
}

export function notifyLidarFrame(): void {
  if (source && listener) listener(source.canvas)
}

export function requestLidarRedraw(): void {
  source?.redraw()
}

export function hasLidarSource(): boolean {
  return source !== null
}
