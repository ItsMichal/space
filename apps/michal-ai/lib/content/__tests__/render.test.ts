import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderMarkdown } from '../render'

describe('renderMarkdown', () => {
  it('keeps accidental text directives as literal text', async () => {
    const html = renderToStaticMarkup(await renderMarkdown('Meet at 10:30 for the demo:launch.'))
    expect(html).toContain('10:30 for the demo:launch.')
    expect(html).not.toContain('mdx-')
  })

  it('leads the conversational callouts with their fixed label and falls back to a note for unknown types', async () => {
    const html = renderToStaticMarkup(
      await renderMarkdown(':::callout{type="before"}\nRead the hashing post first.\n:::\n\n:::callout{type="ask"}\nWhy?\n:::\n\n:::callout{type="shout"}\nx\n:::'),
    )
    expect(html).toContain('class="callout callout--before"')
    expect(html).toContain('<p class="callout__label">Before you continue</p>')
    expect(html).toContain('<p class="callout__label">You might be wondering</p>')
    expect(html).toContain('class="callout callout--note"')
  })
})
