// "/" command menu: a Tiptap Suggestion whose UI is rendered by components/editor/SlashMenu.tsx.
import { Extension, type Editor, type Range } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SlashItem } from './types'
import { uiBus } from './ui-bus'

/** The React menu registers its key handler here so the Suggestion plugin can forward keystrokes. */
export const slashController: { onKeyDown: ((event: KeyboardEvent) => boolean) | null } = { onKeyDown: null }

export type SlashState = {
  items: SlashItem[]
  clientRect: (() => DOMRect | null) | null
  command: (item: SlashItem) => void
}

export const filterSlash = (items: SlashItem[], query: string): SlashItem[] => {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items
    .map((item) => {
      const hay = [item.title, ...(item.keywords ?? [])].map((s) => s.toLowerCase())
      const score = hay.some((h) => h.startsWith(q)) ? 0 : hay.some((h) => h.includes(q)) ? 1 : 2
      return { item, score }
    })
    .filter((x) => x.score < 2)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.item)
}

export const SlashCommand = Extension.create<{ items: SlashItem[] }>({
  name: 'slashCommand',
  addOptions: () => ({ items: [] }),
  addProseMirrorPlugins() {
    const all = this.options.items
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterSlash(all, query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          editor.chain().focus().deleteRange(range).run()
          props.run(editor, range)
        },
        render: () => ({
          onStart: (p) => uiBus.emit('slash', { items: p.items, clientRect: p.clientRect ?? null, command: (i: SlashItem) => p.command(i) } satisfies SlashState),
          onUpdate: (p) => uiBus.emit('slash', { items: p.items, clientRect: p.clientRect ?? null, command: (i: SlashItem) => p.command(i) } satisfies SlashState),
          onKeyDown: ({ event }) => slashController.onKeyDown?.(event) ?? false,
          onExit: () => uiBus.emit('slash', null),
        }),
      }),
    ]
  },
})
