export function planes(data: Float32Array, count: number): { b: number; planes: { raan: number; idx: number[] }[] }[]
export function buildLinks(
  data: Float32Array,
  count: number,
  opts?: { maxGap?: number; maxCross?: number; crossEvery?: number },
): { a: Int32Array; b: Int32Array }
