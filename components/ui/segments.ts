export type Segment = { left: number; width: number }

/** Index of the segment whose centre is nearest `x` (all in the same coordinate space). */
export function nearestSegment(segs: readonly Segment[], x: number): number {
  let best = 0
  let bd = Infinity
  segs.forEach((s, i) => {
    const d = Math.abs(s.left + s.width / 2 - x)
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return best
}

/** Filter vocabulary for the project index: tags in the content map onto a few friendly buckets. */
export const PROJECT_FILTERS = [
  { value: 'all', label: 'All', tags: [] as string[] },
  { value: 'web', label: 'Web', tags: ['web', 'next.js', 'react'] },
  { value: 'ai', label: 'AI', tags: ['ai/ml', 'ai'] },
  { value: 'games', label: 'Games', tags: ['game dev', 'unity', 'rhythm', 'games'] },
] as const

export type ProjectFilter = (typeof PROJECT_FILTERS)[number]['value']

/** Does a post with these tags belong under `filter`? "all" matches everything. */
export function matchesFilter(tags: readonly string[], filter: string): boolean {
  const f = PROJECT_FILTERS.find((p) => p.value === filter)
  if (!f || f.value === 'all') return true
  const lower = tags.map((t) => t.toLowerCase())
  return f.tags.some((t) => lower.includes(t))
}

/** Filters that at least one post matches (so the control never offers an empty bucket). */
export function availableFilters(all: readonly (readonly string[])[]) {
  return PROJECT_FILTERS.filter((f) => f.value === 'all' || all.some((tags) => matchesFilter(tags, f.value)))
}
