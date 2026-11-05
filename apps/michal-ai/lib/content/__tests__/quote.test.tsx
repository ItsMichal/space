// :::quote (components/mdx/Quote.tsx): the heading from its attributes, the first paragraph always shown, the rest behind
// "Read the full text", and the source link only when the url is http(s).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../render'
import { bodyProblems } from '../rules.mjs'

const html = async (md: string) => renderToStaticMarkup(await renderMarkdown(md))
const MD = ':::quote{title="A tribute" by="Hon. A. Member" role="of Somewhere" date="2014-07-03" cite="A record, p. 1" url="https://www.govinfo.gov/x"}\nFirst paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n:::'

describe(':::quote', () => {
  it('shows the heading and the first paragraph, and puts the rest behind a disclosure', async () => {
    const out = await html(MD)
    expect(out).toContain('A record, p. 1')
    expect(out).toContain('A tribute')
    expect(out).toContain('Hon. A. Member of Somewhere')
    expect(out).toContain('<time dateTime="2014-07-03">Thursday, July 3, 2014</time>')
    const lead = out.indexOf('First paragraph.')
    const details = out.indexOf('<details')
    expect(lead).toBeGreaterThan(-1)
    expect(details).toBeGreaterThan(lead)
    expect(out.indexOf('Second paragraph.')).toBeGreaterThan(details)
    expect(out.indexOf('Third paragraph.')).toBeGreaterThan(details)
    expect(out).toContain('Read the full text')
    expect(out).toContain('href="https://www.govinfo.gov/x"')
    expect(out).toContain('The original at govinfo.gov')
  })

  it('has no disclosure for a single paragraph, and no source link without a url', async () => {
    const out = await html(':::quote{title="Short"}\nOnly one.\n:::')
    expect(out).toContain('Only one.')
    expect(out).not.toContain('<details')
    expect(out).not.toContain('The original at')
  })

  it('passes the content rules', () => {
    expect(bodyProblems(MD)).toEqual([])
  })
})
