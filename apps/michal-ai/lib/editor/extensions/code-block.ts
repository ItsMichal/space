import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { SquareCode } from 'lucide-react'
import type { EditorExtension } from '../types'
import { CodeLanguageBar } from '@/components/editor/context/CodeLanguageBar'

export const lowlight = createLowlight(common)

export const codeBlock: EditorExtension = {
  id: 'codeBlock',
  tiptap: () => [
    CodeBlockLowlight.extend({
      addAttributes() {
        return { ...this.parent?.(), meta: { default: null, rendered: false } }
      },
    }).configure({ lowlight, defaultLanguage: null }),
  ],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'code',
        parse: (n) => {
          const c = n as { lang?: string | null; meta?: string | null; value: string }
          return {
            type: 'codeBlock',
            attrs: { language: c.lang || null, meta: c.meta || null },
            ...(c.value ? { content: [{ type: 'text', text: c.value }] } : {}),
          }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      codeBlock: (node) => ({
        type: 'code',
        lang: (node.attrs?.language as string) || null,
        meta: (node.attrs?.meta as string) || null,
        value: (node.content ?? []).map((t) => t.text ?? '').join(''),
      }),
    },
  },
  slash: [
    {
      id: 'codeBlock',
      title: 'Code block',
      description: 'Syntax-highlighted code',
      keywords: ['code', 'pre', 'snippet', '```'],
      icon: SquareCode,
      group: 'Advanced',
      run: (e) => e.chain().focus().setCodeBlock().run(),
    },
  ],
  toolbar: [
    {
      id: 'codeBlock',
      title: 'Code block',
      shortcut: 'Mod-Alt-C',
      icon: SquareCode,
      group: 'block',
      isActive: (e) => e.isActive('codeBlock'),
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
  ],
  contexts: [{ id: 'codeBlock', when: (e) => e.isActive('codeBlock'), Component: CodeLanguageBar }],
}
