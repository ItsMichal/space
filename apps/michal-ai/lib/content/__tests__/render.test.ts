import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderMarkdown } from '../render'

describe('renderMarkdown', () => {
  it('keeps accidental text directives as literal text', async () => {
    const html = renderToStaticMarkup(await renderMarkdown('Meet at 10:30 for the demo:launch.'))
    expect(html).toContain('10:30 for the demo:launch.')
    expect(html).not.toContain('mdx-')
  })
})
