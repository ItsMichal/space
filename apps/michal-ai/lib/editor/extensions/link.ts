import Link from '@tiptap/extension-link'
import { Link as LinkIcon } from 'lucide-react'
import type { EditorExtension } from '../types'
import { uiBus } from '../ui-bus'

export const link: EditorExtension = {
  id: 'link',
  tiptap: () => [
    Link.extend({
      addAttributes() {
        return { ...this.parent?.(), title: { default: null } }
      },
      addKeyboardShortcuts() {
        return { 'Mod-k': () => (uiBus.emit('link'), true) }
      },
    }).configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: { rel: null, target: null },
    }),
  ],
  parse: {
    marks: [
      {
        match: (n) => n.type === 'link',
        mark: (n) => {
          const l = n as { url: string; title?: string | null }
          return { type: 'link', attrs: { href: l.url, ...(l.title ? { title: l.title } : {}) } }
        },
      },
    ],
  },
  serialize: {
    marks: {
      link: {
        order: 0,
        wrap: (children, attrs) => ({
          type: 'link',
          url: String(attrs.href ?? ''),
          title: attrs.title ? String(attrs.title) : null,
          children,
        }),
      },
    },
  },
  toolbar: [
    { id: 'link', title: 'Link', shortcut: 'Mod-K', icon: LinkIcon, group: 'inline', bubble: true, isActive: (e) => e.isActive('link'), run: () => uiBus.emit('link') },
  ],
}
