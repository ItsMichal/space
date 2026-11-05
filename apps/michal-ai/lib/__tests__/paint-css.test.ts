import { describe, expect, it } from 'vitest'
import { fit, linearDir, parseGradient, parseShadows, parseStops, placeStops, px, radii, splitTop } from '@/lib/paint/css'

describe('page painter CSS reading', () => {
  it('splits lists outside parentheses', () => {
    expect(splitTop('rgba(0, 0, 0, 0.1) 0px 4px 12px 0px, red 1px 1px', ',')).toEqual(['rgba(0, 0, 0, 0.1) 0px 4px 12px 0px', 'red 1px 1px'])
    expect(splitTop('rgb(1 2 3) calc(100% - 4px)', ' ')).toEqual(['rgb(1 2 3)', 'calc(100% - 4px)'])
  })

  it('reads px, percentages and simple calc()', () => {
    expect(px('12px')).toBe(12)
    expect(px('50%', 300)).toBe(150)
    expect(px('calc(100% - 64px)', 400)).toBe(336)
    expect(px('calc(50% + 2px)', 100)).toBe(52)
    expect(px('auto')).toBeNaN()
  })

  it('points linear gradients the way CSS does', () => {
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5))
    near(linearDir(null, 100, 50), [0, 1])
    near(linearDir('90deg', 100, 50), [1, 0])
    near(linearDir('to top', 100, 50), [0, -1])
    near(linearDir('0.5turn', 100, 50), [0, 1])
    // to a corner: square to the other diagonal, so a wide box leans mostly down
    const [x, y] = linearDir('to bottom right', 200, 100)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(x)
  })

  it('reads computed gradients, their stops spread as CSS spreads them', () => {
    const g = parseGradient('linear-gradient(rgba(244, 241, 232, 0), rgba(244, 241, 232, 0.9) 96px, rgba(244, 241, 232, 0.9) calc(100% - 64px), rgba(244, 241, 232, 0))', 400, 1000)
    expect(g?.kind).toBe('linear')
    if (g?.kind !== 'linear') return
    expect(g.length).toBe(1000)
    const s = placeStops(parseStops(g.stops, g.length))
    expect(s.map((x) => x.at)).toEqual([0, 0.096, 0.936, 1])
    expect(s[1].color).toBe('rgba(244, 241, 232, 0.9)')
    expect(placeStops(parseStops(['red', 'blue', 'green'], 10)).map((x) => x.at)).toEqual([0, 0.5, 1])
    // a stop never goes back
    expect(placeStops(parseStops(['red 50%', 'blue 20%'], 10)).map((x) => x.at)).toEqual([0.5, 0.5])
  })

  it('reads radial gradients with a shape, size and position', () => {
    const g = parseGradient('radial-gradient(circle at 50% 0%, rgb(255, 0, 0) 0%, rgba(0, 0, 0, 0) 60%)', 100, 100)
    expect(g).toMatchObject({ kind: 'radial', circle: true, at: ['50%', '0%'] })
    const e = parseGradient('radial-gradient(120% 80% at right top, red, blue)', 100, 100)
    expect(e).toMatchObject({ kind: 'radial', circle: false, size: ['120%', '80%'], at: ['100%', '0%'] })
    expect(parseGradient('url("a.png")', 1, 1)).toBeNull()
  })

  it('reads box shadows, inset ones too', () => {
    expect(parseShadows('none')).toEqual([])
    expect(parseShadows('rgba(0, 0, 0, 0.1) 0px 4px 12px 0px, rgb(1, 2, 3) 3px 0px 0px 0px inset')).toEqual([
      { inset: false, x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(0, 0, 0, 0.1)' },
      { inset: true, x: 3, y: 0, blur: 0, spread: 0, color: 'rgb(1, 2, 3)' },
    ])
  })

  it('shrinks corner radii together when they would overlap', () => {
    expect(radii(['8px', '8px', '8px', '8px'], 100, 40)).toEqual([8, 8, 8, 8])
    expect(radii(['999px', '999px', '999px', '999px'], 100, 40)).toEqual([20, 20, 20, 20])
    expect(radii(['50%', '50%', '50%', '50%'], 40, 40)).toEqual([20, 20, 20, 20])
  })

  it('fits pictures as object-fit does', () => {
    expect(fit('cover', 200, 100, 100, 100)).toEqual({ x: -50, y: 0, w: 200, h: 100 })
    expect(fit('contain', 200, 100, 100, 100)).toEqual({ x: 0, y: 25, w: 100, h: 50 })
    expect(fit('fill', 200, 100, 100, 100)).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })
})
