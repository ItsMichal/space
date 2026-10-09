// Document, text, paragraph, hard break, history and editor chrome (placeholder, counts, focus mode).
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import HardBreak from '@tiptap/extension-hard-break'
import { CharacterCount, Dropcursor, Focus, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions'
import { Pilcrow } from 'lucide-react'
import type { PhrasingContent } from 'mdast'
import type { EditorExtension } from '../types'

export const core: EditorExtension = {
  id: 'core',
  tiptap: ({ placeholder }) => [
    Document,
    Text,
    Paragraph,
    HardBreak,
    UndoRedo,
    Dropcursor.configure({ color: 'var(--accent)', width: 2 }),
    Gapcursor,
    CharacterCount,
    Focus.configure({ className: 'has-focus', mode: 'deepest' }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'paragraph' ? (placeholder ?? 'Write something, or type / for blocks') : '',
      showOnlyCurrent: true,
    }),
  ],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'paragraph',
        parse: (n, ctx) => {
          const content = ctx.inline((n as { children: PhrasingContent[] }).children)
          return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      paragraph: (node, ctx) => {
        const children = ctx.inline(node.content)
        if (!children.length) return null // empty paragraphs are editor whitespace, not markdown
        return { type: 'paragraph', children }
      },
    },
  },
  slash: [
    {
      id: 'paragraph',
      title: 'Text',
      description: 'Plain paragraph',
      keywords: ['paragraph', 'p', 'plain'],
      icon: Pilcrow,
      group: 'Text',
      run: (editor) => editor.chain().focus().setParagraph().run(),
    },
  ],
}
