import Blockquote from '@tiptap/extension-blockquote'
import { Quote } from 'lucide-react'
import type { RootContent } from 'mdast'
import type { EditorExtension } from '../types'

export const blockquote: EditorExtension = {
  id: 'blockquote',
  tiptap: () => [Blockquote],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'blockquote',
        parse: (n, ctx) => {
          const content = ctx.blocks((n as { children: RootContent[] }).children)
          return { type: 'blockquote', content: content.length ? content : [{ type: 'paragraph' }] }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      blockquote: (node, ctx) => {
        const children = ctx.blocks(node.content) as never[]
        return children.length ? { type: 'blockquote', children } : null
      },
    },
  },
  slash: [
    {
      id: 'blockquote',
      title: 'Quote',
      description: 'Pull quote or citation',
      keywords: ['blockquote', 'quote', 'cite'],
      icon: Quote,
      group: 'Text',
      run: (e) => e.chain().focus().setBlockquote().run(),
    },
  ],
  toolbar: [
    {
      id: 'blockquote',
      title: 'Quote',
      shortcut: 'Mod-Shift-B',
      icon: Quote,
      group: 'block',
      bubble: true,
      isActive: (e) => e.isActive('blockquote'),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
  ],
}
