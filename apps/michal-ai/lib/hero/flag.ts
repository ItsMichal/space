// Which decorative hero background the home page draws. Flip HERO_DEFAULT to switch the site; `?hero=ascii` or
// `?hero=globe` on the home URL overrides it for one visit, to compare the two.
export type HeroKind = 'globe' | 'ascii'

export const HERO_DEFAULT: HeroKind = 'ascii'

export function heroFromSearch(search: string, fallback: HeroKind = HERO_DEFAULT): HeroKind {
  const v = new URLSearchParams(search).get('hero')
  return v === 'ascii' || v === 'globe' ? v : fallback
}
