import Heading from '@tiptap/extension-heading'
import { Heading2, Heading3 } from 'lucide-react'
import type { PhrasingContent } from 'mdast'
import type { EditorExtension } from '../types'

// H1 is the title field, but the schema keeps 1-4 so existing content round-trips and the SEO panel can flag stray H1s.
export const heading: EditorExtension = {
  id: 'heading',
  tiptap: () => [Heading.configure({ levels: [1, 2, 3, 4] })],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'heading',
        parse: (n, ctx) => {
          const h = n as { depth: number; children: PhrasingContent[] }
          const content = ctx.inline(h.children)
          const level = Math.min(4, Math.max(1, h.depth))
          return content.length ? { type: 'heading', attrs: { level }, content } : { type: 'heading', attrs: { level } }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      heading: (node, ctx) => {
        const children = ctx.inline(node.content)
        if (!children.length) return null
        return { type: 'heading', depth: (node.attrs?.level ?? 2) as 1 | 2 | 3 | 4, children }
      },
    },
  },
  slash: [2, 3].map((level) => ({
    id: `h${level}`,
    title: `Heading ${level}`,
    description: level === 2 ? 'Section heading' : 'Sub-section heading',
    keywords: ['heading', 'title', `h${level}`],
    icon: level === 2 ? Heading2 : Heading3,
    group: 'Text' as const,
    run: (editor) => editor.chain().focus().setHeading({ level: level as 2 | 3 }).run(),
  })),
  toolbar: [2, 3].map((level) => ({
    id: `h${level}`,
    title: `Heading ${level}`,
    shortcut: `Mod-Alt-${level}`,
    icon: level === 2 ? Heading2 : Heading3,
    group: 'block' as const,
    bubble: true,
    isActive: (e) => e.isActive('heading', { level }),
    run: (e) => e.chain().focus().toggleHeading({ level: level as 2 | 3 }).run(),
  })),
}
