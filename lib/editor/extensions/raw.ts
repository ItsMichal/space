// Fallback: any block no other module understands (raw HTML, link definitions, unknown directives, footnotes)
// is kept verbatim as markdown source so opening and saving a post never destroys content.
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { RawView } from '@/components/editor/views/RawView'
import type { EditorExtension } from '../types'

const RawNode = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { source: { default: '' } }
  },
  parseHTML: () => [{ tag: 'pre[data-raw]' }],
  renderHTML: ({ HTMLAttributes }) => ['pre', { 'data-raw': '' }, String(HTMLAttributes.source ?? '')],
  addNodeView: () => ReactNodeViewRenderer(RawView),
})

export const raw: EditorExtension = {
  id: 'rawBlock',
  tiptap: () => [RawNode],
  parse: {
    blocks: [
      {
        priority: -100,
        match: () => true,
        parse: (n, ctx) => ({ type: 'rawBlock', attrs: { source: ctx.stringify(n) } }),
      },
    ],
  },
  serialize: {
    nodes: {
      rawBlock: (node) => (node.attrs?.source ? { type: 'html', value: String(node.attrs.source) } : null),
    },
  },
}
