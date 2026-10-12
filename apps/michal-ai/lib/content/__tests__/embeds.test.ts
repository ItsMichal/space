import { describe, expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import { rehypeDropDeadEmbeds } from '../../embeds'
import manifest from '../../../content/embed-status.json'

const el = (tagName: string, properties: Element['properties'] = {}, children: Element['children'] = []): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
})
const text = (value: string) => ({ type: 'text' as const, value })
const yt = (id: string) => el('mdx-youtube', { id })
const run = (children: Root['children']) => {
  const tree: Root = { type: 'root', children }
  rehypeDropDeadEmbeds((n) => n.tagName === 'mdx-youtube' && String(n.properties?.id).startsWith('dead'))(tree)
  return tree.children.map((n) => (n.type === 'element' ? `${n.tagName}${n.properties?.id ? ':' + n.properties.id : ''}` : 'text'))
}

describe('rehypeDropDeadEmbeds', () => {
  it('drops dead embeds and the heading left with nothing under it', () => {
    expect(run([el('p', {}, [text('intro')]), el('h3', {}, [text('Videos')]), text('\n'), yt('dead1'), text('\n'), yt('dead2')])).toEqual(['p'])
  })

  it('keeps a heading that still has a playable video or other content', () => {
    expect(run([el('h3', {}, [text('Videos')]), yt('dead1'), yt('live1')])).toEqual(['h3', 'mdx-youtube:live1'])
    expect(run([el('h3', {}, [text('Videos')]), yt('dead1'), el('p', {}, [text('words')])])).toEqual(['h3', 'p'])
  })

  it('only closes a section at a heading of the same or higher level (a parent heading is kept)', () => {
    expect(run([el('h2', {}, [text('Demos')]), el('h3', {}, [text('Clips')]), yt('dead1')])).toEqual(['h2'])
    expect(run([el('h3', {}, [text('Clips')]), el('h2', {}, [text('Next')]), yt('dead1')])).toEqual(['h3'])
  })

  it('leaves headings that were already empty alone', () => {
    expect(run([el('h3', {}, [text('Soon')]), el('h3', {}, [text('Later')])])).toEqual(['h3', 'h3'])
  })
})

describe('embed manifest', () => {
  it('has an entry for every video id used in published posts', async () => {
    const fs = await import('node:fs')
    const dir = 'content/posts'
    const ids = new Set<string>()
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const t = fs.readFileSync(`${dir}/${f}`, 'utf8')
      if (/^draft: true/m.test(t)) continue
      for (const m of t.matchAll(/^::youtube\{[^}]*\bid="([^"]+)"/gm)) ids.add(m[1])
    }
    for (const id of ids) expect(manifest.youtube, id).toHaveProperty(id)
  })
})
