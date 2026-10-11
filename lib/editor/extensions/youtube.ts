// ::youtube{id="..."} leaf directive.
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Video } from 'lucide-react'
import type { LeafDirective } from 'mdast-util-directive'
import type { EditorExtension } from '../types'
import { YouTubeView } from '@/components/editor/views/YouTubeView'

const YouTubeNode = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { id: { default: '' }, title: { default: null } }
  },
  parseHTML: () => [{ tag: 'div[data-youtube]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', { 'data-youtube': HTMLAttributes.id }],
  addNodeView: () => ReactNodeViewRenderer(YouTubeView),
})

export const youtube: EditorExtension = {
  id: 'youtube',
  tiptap: () => [YouTubeNode],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'leafDirective' && (n as LeafDirective).name === 'youtube',
        parse: (n) => {
          const a = (n as LeafDirective).attributes ?? {}
          return { type: 'youtube', attrs: { id: a.id ?? '', title: a.title ?? null } }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      youtube: (node) => {
        const id = String(node.attrs?.id ?? '')
        if (!id) return null
        const title = node.attrs?.title ? String(node.attrs.title) : undefined
        return { type: 'leafDirective', name: 'youtube', attributes: { id, ...(title ? { title } : {}) }, children: [] }
      },
    },
  },
  slash: [
    {
      id: 'youtube',
      title: 'YouTube',
      description: 'Privacy-friendly video embed',
      keywords: ['youtube', 'video', 'embed'],
      icon: Video,
      group: 'Embeds',
      run: (e) => e.chain().focus().insertContent({ type: 'youtube', attrs: { id: '' } }).run(),
    },
  ],
  toolbar: [
    {
      id: 'youtube',
      title: 'YouTube',
      icon: Video,
      group: 'insert',
      run: (e) => e.chain().focus().insertContent({ type: 'youtube', attrs: { id: '' } }).run(),
    },
  ],
}
