// Paste handling: plain-text clipboard that looks like markdown (or comes from a code editor) is parsed as markdown,
// so pasting a README, a ChatGPT answer or a fenced snippet keeps its structure. Rich HTML (web pages) is left to Tiptap.
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { JSONContent } from './types'

const BLOCK_SYNTAX = /^(#{1,6} |[-*+] |\d+[.)] |> |```|~~~|\|.+\||:::|::[a-z]|- \[[ x]\] |---$)/m
const INLINE_SYNTAX = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|!\[[^\]\n]*\]\([^)\s]+\))/

export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim()
  if (!t || /^https?:\/\/\S+$/.test(t)) return false // a bare URL: let the Link extension handle it
  return BLOCK_SYNTAX.test(t) || (t.includes('\n') && INLINE_SYNTAX.test(t)) || INLINE_SYNTAX.test(t)
}

export const PasteMarkdown = Extension.create<{ parse: (markdown: string) => JSONContent }>({
  name: 'pasteMarkdown',
  priority: 120,
  addOptions: () => ({ parse: () => ({ type: 'doc', content: [] }) }),
  addProseMirrorPlugins() {
    const editor = this.editor
    const { parse } = this.options
    return [
      new Plugin({
        key: new PluginKey('pasteMarkdown'),
        props: {
          handlePaste(view, event) {
            const data = event.clipboardData
            if (!data || data.files.length) return false
            if (view.state.selection.$from.parent.type.spec.code) return false // paste verbatim inside code
            const text = data.getData('text/plain')
            const html = data.getData('text/html')
            const fromCodeEditor = data.types.includes('vscode-editor-data')
            if (html && !fromCodeEditor) return false
            if (!looksLikeMarkdown(text)) return false
            const doc = parse(text)
            if (!doc.content?.length) return false
            editor.chain().focus().insertContent(doc.content).run()
            return true
          },
        },
      }),
    ]
  },
})
