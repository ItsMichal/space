// Bullet, ordered and task lists. mdast has one `list` node; Tiptap has three, so parse picks by shape.
import { BulletList, ListItem, OrderedList, TaskItem, TaskList } from '@tiptap/extension-list'
import { List, ListOrdered, ListTodo } from 'lucide-react'
import type { List as MdList, ListItem as MdListItem } from 'mdast'
import type { EditorExtension, JSONContent, ParseContext, SerializeContext } from '../types'

function itemContent(item: MdListItem, ctx: ParseContext): JSONContent[] {
  const content = ctx.blocks(item.children)
  // Tiptap list items must start with a paragraph; the empty one is dropped again on serialise.
  if (!content.length || content[0].type !== 'paragraph') content.unshift({ type: 'paragraph' })
  return content
}

function listItem(node: JSONContent, ctx: SerializeContext, checked?: boolean | null): MdListItem {
  return {
    type: 'listItem',
    spread: false,
    ...(checked !== undefined && checked !== null ? { checked: Boolean(checked) } : {}),
    children: ctx.blocks(node.content) as MdListItem['children'],
  }
}

export const lists: EditorExtension = {
  id: 'lists',
  tiptap: () => [
    BulletList,
    OrderedList,
    // `checked` is only set on items of mixed lists (some `[x]`, some plain) so they survive a round trip.
    ListItem.extend({
      addAttributes() {
        return { ...this.parent?.(), checked: { default: null, rendered: false } }
      },
    }),
    TaskList, TaskItem.configure({ nested: true }),
  ],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'list',
        parse: (n, ctx) => {
          const list = n as MdList
          const isTask = (i: MdListItem) => i.checked !== null && i.checked !== undefined
          if (list.children.every(isTask)) {
            return {
              type: 'taskList',
              content: list.children.map((i) => ({
                type: 'taskItem',
                attrs: { checked: i.checked === true },
                content: itemContent(i, ctx),
              })),
            }
          }
          const items = list.children.map((i) => ({
            type: 'listItem',
            ...(isTask(i) ? { attrs: { checked: i.checked === true } } : {}),
            content: itemContent(i, ctx),
          }))
          return list.ordered
            ? { type: 'orderedList', attrs: { start: list.start ?? 1 }, content: items }
            : { type: 'bulletList', content: items }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      bulletList: (node, ctx) => ({
        type: 'list',
        ordered: false,
        spread: false,
        children: (node.content ?? []).map((i) => listItem(i, ctx, i.attrs?.checked ?? undefined)),
      }),
      orderedList: (node, ctx) => ({
        type: 'list',
        ordered: true,
        start: (node.attrs?.start as number) ?? 1,
        spread: false,
        children: (node.content ?? []).map((i) => listItem(i, ctx, i.attrs?.checked ?? undefined)),
      }),
      taskList: (node, ctx) => ({
        type: 'list',
        ordered: false,
        spread: false,
        children: (node.content ?? []).map((i) => listItem(i, ctx, Boolean(i.attrs?.checked))),
      }),
    },
  },
  slash: [
    { id: 'bulletList', title: 'Bulleted list', description: 'Simple unordered list', keywords: ['ul', 'bullet', 'list'], icon: List, group: 'Lists', run: (e) => e.chain().focus().toggleBulletList().run() },
    { id: 'orderedList', title: 'Numbered list', description: 'Ordered list', keywords: ['ol', 'number', 'ordered', 'list'], icon: ListOrdered, group: 'Lists', run: (e) => e.chain().focus().toggleOrderedList().run() },
    { id: 'taskList', title: 'Task list', description: 'Checklist with checkboxes', keywords: ['todo', 'task', 'check', 'checklist'], icon: ListTodo, group: 'Lists', run: (e) => e.chain().focus().toggleTaskList().run() },
  ],
  toolbar: [
    { id: 'bulletList', title: 'Bulleted list', shortcut: 'Mod-Shift-8', icon: List, group: 'block', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
    { id: 'orderedList', title: 'Numbered list', shortcut: 'Mod-Shift-7', icon: ListOrdered, group: 'block', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { id: 'taskList', title: 'Task list', shortcut: 'Mod-Shift-9', icon: ListTodo, group: 'block', isActive: (e) => e.isActive('taskList'), run: (e) => e.chain().focus().toggleTaskList().run() },
  ],
}
