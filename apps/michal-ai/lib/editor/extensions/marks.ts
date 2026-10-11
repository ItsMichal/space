// Bold, italic, strike and inline code: four tiny modules sharing one file because they are pure mark <-> mdast maps.
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Strike from '@tiptap/extension-strike'
import Code from '@tiptap/extension-code'
import { Bold as BoldIcon, Code as CodeIcon, Italic as ItalicIcon, Strikethrough } from 'lucide-react'
import type { EditorExtension } from '../types'

export const bold: EditorExtension = {
  id: 'bold',
  tiptap: () => [Bold],
  parse: { marks: [{ match: (n) => n.type === 'strong', mark: () => ({ type: 'bold' }) }] },
  serialize: { marks: { bold: { order: 1, wrap: (children) => ({ type: 'strong', children }) } } },
  toolbar: [
    { id: 'bold', title: 'Bold', shortcut: 'Mod-B', icon: BoldIcon, group: 'inline', bubble: true, isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  ],
}

export const italic: EditorExtension = {
  id: 'italic',
  tiptap: () => [Italic],
  parse: { marks: [{ match: (n) => n.type === 'emphasis', mark: () => ({ type: 'italic' }) }] },
  serialize: { marks: { italic: { order: 2, wrap: (children) => ({ type: 'emphasis', children }) } } },
  toolbar: [
    { id: 'italic', title: 'Italic', shortcut: 'Mod-I', icon: ItalicIcon, group: 'inline', bubble: true, isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  ],
}

export const strike: EditorExtension = {
  id: 'strike',
  tiptap: () => [Strike],
  parse: { marks: [{ match: (n) => n.type === 'delete', mark: () => ({ type: 'strike' }) }] },
  serialize: { marks: { strike: { order: 3, wrap: (children) => ({ type: 'delete', children }) } } },
  toolbar: [
    { id: 'strike', title: 'Strikethrough', shortcut: 'Mod-Shift-S', icon: Strikethrough, group: 'inline', bubble: true, isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  ],
}

export const inlineCode: EditorExtension = {
  id: 'code',
  // Tiptap's default excludes every other mark; markdown allows links and emphasis around code, so allow them.
  tiptap: () => [Code.extend({ excludes: '' })],
  parse: { marks: [{ match: (n) => n.type === 'inlineCode', mark: () => ({ type: 'code' }) }] },
  serialize: {
    marks: {
      code: {
        order: 4,
        keepWhitespace: true,
        wrap: (children) => ({
          type: 'inlineCode',
          value: children.map((c) => ('value' in c ? String(c.value) : '')).join(''),
        }),
      },
    },
  },
  toolbar: [
    { id: 'code', title: 'Inline code', shortcut: 'Mod-E', icon: CodeIcon, group: 'inline', bubble: true, isActive: (e) => e.isActive('code'), run: (e) => e.chain().focus().toggleCode().run() },
  ],
}
