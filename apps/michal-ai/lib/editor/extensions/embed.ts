// ::embed{url="..."} leaf directive: any https iframe (CodePen, Figma, Observable...).
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { AppWindow } from 'lucide-react'
import type { LeafDirective } from 'mdast-util-directive'
import type { EditorExtension } from '../types'
import { EmbedView } from '@/components/editor/views/EmbedView'

const EmbedNode = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: '' }, title: { default: null }, ratio: { default: null } }
  },
  parseHTML: () => [{ tag: 'div[data-embed]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { 'data-embed': HTMLAttributes.url }],
  addNodeView: () => ReactNodeViewRenderer(EmbedView),
})

export const embed: EditorExtension = {
  id: 'embed',
  tiptap: () => [EmbedNode],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'leafDirective' && (n as LeafDirective).name === 'embed',
        parse: (n) => {
          const a = (n as LeafDirective).attributes ?? {}
          return { type: 'embed', attrs: { url: a.url ?? '', title: a.title ?? null, ratio: a.ratio ?? null } }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      embed: (node) => {
        const url = String(node.attrs?.url ?? '')
        if (!url) return null
        const attributes: Record<string, string> = { url }
        if (node.attrs?.title) attributes.title = String(node.attrs.title)
        if (node.attrs?.ratio) attributes.ratio = String(node.attrs.ratio)
        return { type: 'leafDirective', name: 'embed', attributes, children: [] }
      },
    },
  },
  slash: [
    {
      id: 'embed',
      title: 'Embed',
      description: 'Any https page in an iframe',
      keywords: ['embed', 'iframe', 'codepen', 'figma', 'link'],
      icon: AppWindow,
      group: 'Embeds',
      run: (e) => e.chain().focus().insertContent({ type: 'embed', attrs: { url: '' } }).run(),
    },
  ],
  toolbar: [
    {
      id: 'embed',
      title: 'Embed',
      icon: AppWindow,
      group: 'insert',
      run: (e) => e.chain().focus().insertContent({ type: 'embed', attrs: { url: '' } }).run(),
    },
  ],
}
