import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { getSchema } from '@tiptap/core'
import { Node as PMNode } from '@tiptap/pm/model'
import { parsePost } from '@/lib/content/serialize'
import { renderMarkdown } from '@/lib/content/render'
import { docToMarkdown, markdownToDoc } from '../markdown'
import { buildTiptapExtensions } from '../extensions'

const root = process.cwd()
const postsDir = path.join(root, 'content', 'posts')
const fixturesDir = path.join(__dirname, 'fixtures')

const read = (dir: string, f: string) => fs.readFileSync(path.join(dir, f), 'utf8')
const bodyOf = (dir: string, f: string) => (f.endsWith('.md') && dir === postsDir ? parsePost(read(dir, f), f).body : read(dir, f))

const files = [
  ...fs.readdirSync(postsDir).filter((f) => f.endsWith('.md')).map((f) => ({ name: `content/posts/${f}`, body: bodyOf(postsDir, f) })),
  ...fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.md')).map((f) => ({ name: `fixtures/${f}`, body: bodyOf(fixturesDir, f) })),
]

const schema = getSchema(buildTiptapExtensions())

describe.each(files)('round trip: $name', ({ body }) => {
  const doc1 = markdownToDoc(body)
  const md1 = docToMarkdown(doc1)
  const doc2 = markdownToDoc(md1)
  const md2 = docToMarkdown(doc2)

  it('parse -> serialize -> parse is idempotent (document)', () => {
    expect(doc2).toEqual(doc1)
  })

  it('serialize is a fixed point (markdown)', () => {
    expect(md2).toBe(md1)
  })

  it('produces a document that satisfies the editor schema', () => {
    expect(() => PMNode.fromJSON(schema, doc1).check()).not.toThrow()
  })

  it('output renders through the production pipeline', async () => {
    const html = renderToStaticMarkup(await renderMarkdown(md1) as never)
    expect(html.length).toBeGreaterThan(0)
  })

  it('renders to the same HTML as the original source', async () => {
    const a = renderToStaticMarkup(await renderMarkdown(body) as never)
    const b = renderToStaticMarkup(await renderMarkdown(md1) as never)
    expect(b).toBe(a)
  })
})

describe('specific behaviours', () => {
  it('keeps the sample post byte-stable apart from whitespace normalisation', () => {
    const body = bodyOf(postsDir, 'hello-paper.md')
    expect(docToMarkdown(markdownToDoc(body)).trim()).toBe(body.trim())
  })

  it('maps directives to dedicated nodes', () => {
    const doc = markdownToDoc('::youtube{id="abc"}\n\n::embed{url="https://x.dev"}\n\n:::callout{type="tip"}\nhi\n:::')
    expect(doc.content?.map((n) => n.type)).toEqual(['youtube', 'embed', 'callout'])
  })

  it('keeps image title as caption and alt as alt', () => {
    const doc = markdownToDoc('![the alt](/a.png "the caption")')
    expect(doc.content?.[0]).toEqual({ type: 'image', attrs: { src: '/a.png', alt: 'the alt', title: 'the caption' } })
  })

  it('hoists whitespace out of bold so the markdown stays valid', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'bold ', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'b' },
    ] }] }
    expect(docToMarkdown(doc).trim()).toBe('a **bold** b')
  })

  it('merges adjacent runs sharing a mark', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'one ', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'two', marks: [{ type: 'bold' }, { type: 'italic' }] },
    ] }] }
    expect(docToMarkdown(doc).trim()).toBe('**one _two_**')
  })

  it('drops empty paragraphs and empty embeds', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph' },
      { type: 'youtube', attrs: { id: '' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
    ] }
    expect(docToMarkdown(doc).trim()).toBe('x')
  })

  it('keeps clock times literal (production renders "10:30" as a directive otherwise)', async () => {
    const doc = markdownToDoc('Meet at 10:30 and 5:45pm')
    const md = docToMarkdown(doc)
    expect(doc.content?.[0].content?.map((c) => c.text).join('')).toBe('Meet at 10:30 and 5:45pm')
    const html = renderToStaticMarkup(await renderMarkdown(md) as never)
    expect(html).toContain('10:30')
    expect(html).not.toContain('mdx-')
  })

  it('splits a paragraph around an inline image into text + figure blocks', () => {
    const doc = markdownToDoc('Before ![alt](/a.png) after')
    expect(doc.content?.map((n) => n.type)).toEqual(['paragraph', 'image', 'paragraph'])
    expect(docToMarkdown(doc).trim()).toBe('Before\n\n![alt](/a.png)\n\nafter')
  })

  it('an empty document parses to one empty paragraph', () => {
    expect(markdownToDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })
})
