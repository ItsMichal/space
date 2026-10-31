import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../render'
import { bodyProblems } from '../rules.mjs'

const html = async (md: string) => renderToStaticMarkup(await renderMarkdown(md))
const IMG = '/media/spacex-starlink-general-projects/starlink-night-sky.webp'

describe('inline directives (:term, :fig)', () => {
  it('flags a bad figure number or term colour', () => {
    expect(bodyProblems(':fig[0] and :fig[x] and :term[a]{c=pink}')).toHaveLength(3)
    expect(bodyProblems(':fig[2] and :term[a]{c=green} and :term[b]')).toEqual([])
  })

  it('colours a term, with an unknown colour falling back and other attributes dropped', async () => {
    const out = await html('A :term[carrier]{c=orange} and a :term[thing]{c="red onclick" onclick="alert(1)"}.')
    expect(out).toContain('<span class="term term--orange">carrier</span>')
    expect(out).toContain('<span class="term term--blue">thing</span>')
    expect(out).not.toMatch(/onclick/)
  })

  it('numbers figures in order and labels the cited ones', async () => {
    const out = await html(`![a](${IMG} "First")\n\n![b](${IMG} "Second")\n\nSee :fig[2].`)
    expect(out).toContain('id="fig-1"')
    expect(out).toContain('id="fig-2"')
    expect(out).toContain('href="#fig-2"')
    expect(out.match(/class="figno"/g)).toHaveLength(1)
    expect(out).toMatch(/<span class="figno">fig 2<\/span>Second/)
  })

  it('leaves an invalid figure reference and other inline names as text', async () => {
    const out = await html('A :fig[nope] and :frame[x] here.')
    expect(out).not.toMatch(/figref|mdx-/)
  })
})
