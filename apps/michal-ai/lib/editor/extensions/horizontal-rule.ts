import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { Minus } from 'lucide-react'
import type { EditorExtension } from '../types'

export const horizontalRule: EditorExtension = {
  id: 'horizontalRule',
  tiptap: () => [HorizontalRule],
  parse: { blocks: [{ match: (n) => n.type === 'thematicBreak', parse: () => ({ type: 'horizontalRule' }) }] },
  serialize: { nodes: { horizontalRule: () => ({ type: 'thematicBreak' }) } },
  slash: [
    {
      id: 'divider',
      title: 'Divider',
      description: 'Horizontal rule',
      keywords: ['hr', 'rule', 'divider', 'separator', '---'],
      icon: Minus,
      group: 'Text',
      run: (e) => e.chain().focus().setHorizontalRule().run(),
    },
  ],
}
