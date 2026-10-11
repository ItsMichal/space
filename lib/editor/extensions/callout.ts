// :::callout{type="note"} container directive wrapping any blocks.
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Info } from 'lucide-react'
import type { ContainerDirective } from 'mdast-util-directive'
import type { RootContent } from 'mdast'
import type { EditorExtension } from '../types'
import { CalloutView } from '@/components/editor/views/CalloutView'
import { CalloutBar } from '@/components/editor/context/CalloutBar'

export const CALLOUT_TYPES = ['note', 'tip', 'warning', 'danger'] as const

const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { type: { default: 'note' } }
  },
  parseHTML: () => [{ tag: 'aside[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', { 'data-callout': HTMLAttributes.type }, 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
})

export const callout: EditorExtension = {
  id: 'callout',
  tiptap: () => [CalloutNode],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'containerDirective' && (n as ContainerDirective).name === 'callout',
        parse: (n, ctx) => {
          const d = n as ContainerDirective
          const content = ctx.blocks(d.children as RootContent[])
          return {
            type: 'callout',
            attrs: { type: d.attributes?.type ?? 'note' },
            content: content.length ? content : [{ type: 'paragraph' }],
          }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      callout: (node, ctx) => {
        const children = ctx.blocks(node.content)
        if (!children.length) return null
        return {
          type: 'containerDirective',
          name: 'callout',
          attributes: { type: String(node.attrs?.type ?? 'note') },
          children: children as ContainerDirective['children'],
        }
      },
    },
  },
  slash: [
    {
      id: 'callout',
      title: 'Callout',
      description: 'Highlighted note, tip or warning',
      keywords: ['callout', 'note', 'tip', 'warning', 'aside', 'admonition'],
      icon: Info,
      group: 'Advanced',
      run: (e) => e.chain().focus().toggleWrap('callout').run(),
    },
  ],
  toolbar: [
    {
      id: 'callout',
      title: 'Callout',
      icon: Info,
      group: 'insert',
      isActive: (e) => e.isActive('callout'),
      run: (e) => e.chain().focus().toggleWrap('callout').run(),
    },
  ],
  contexts: [{ id: 'callout', when: (e) => e.isActive('callout'), Component: CalloutBar }],
}
