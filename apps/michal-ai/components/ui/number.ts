export type RollColumn = { kind: 'char'; ch: string } | { kind: 'digit'; strip: number[]; delay: number }

/**
 * Plan the columns of a roll. Every digit travels `travel` steps (default 3 for the first, fewer for the rest, so the
 * columns do not move in lockstep) and ends on its true value; the strip lists the digits it passes, in order, ending
 * with the real one. Non-digits stay put. `delay` staggers from the left.
 */
export function rollDigits(text: string, travel = 3): RollColumn[] {
  let k = 0
  const out: RollColumn[] = []
  for (const ch of text) {
    if (!/\d/.test(ch)) {
      out.push({ kind: 'char', ch })
      continue
    }
    const end = Number(ch)
    const steps = travel + (k % 2)
    const strip: number[] = []
    for (let s = steps; s >= 0; s--) strip.push((((end - s) % 10) + 10) % 10)
    out.push({ kind: 'digit', strip, delay: k * 140 })
    k++
  }
  return out
}
