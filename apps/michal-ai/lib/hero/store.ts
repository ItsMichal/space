// Which rotating hero phrase is on screen. Written by <HeroHook>, read by <HeroAtmosphere>. A plain external store:
// one tiny store so the two components need not share a parent.
let index = 0
const subs = new Set<(i: number) => void>()

export const getHeroIndex = () => index
export const setHeroIndex = (i: number) => {
  if (i === index) return
  index = i
  subs.forEach((f) => f(i))
}
export const onHeroIndex = (f: (i: number) => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
