// GFM tables. A cell holds a single paragraph (mdast cells are phrasing-only); column alignment lives on the table node.
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Table as TableIcon } from 'lucide-react'
import type { Table as MdTable, TableRow as MdRow, PhrasingContent } from 'mdast'
import type { EditorExtension, JSONContent } from '../types'
import { TableBar } from '@/components/editor/context/TableBar'

type Align = 'left' | 'right' | 'center' | null

const cellText = (cell: JSONContent): JSONContent[] =>
  (cell.content ?? [])
    .flatMap((p) => p.content ?? [])
    .map((n) => (n.type === 'hardBreak' ? { type: 'text', text: ' ' } : n))

export const table: EditorExtension = {
  id: 'table',
  tiptap: () => [
    Table.extend({
      addAttributes() {
        return { ...this.parent?.(), align: { default: null, rendered: false } }
      },
    }).configure({ resizable: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph' }),
    TableCell.extend({ content: 'paragraph' }),
  ],
  parse: {
    blocks: [
      {
        match: (n) => n.type === 'table',
        parse: (n, ctx) => {
          const t = n as MdTable
          return {
            type: 'table',
            attrs: { align: t.align && t.align.some(Boolean) ? t.align : null },
            content: t.children.map((row, ri) => ({
              type: 'tableRow',
              content: row.children.map((cell) => {
                const inline = ctx.inline(cell.children as PhrasingContent[])
                return {
                  type: ri === 0 ? 'tableHeader' : 'tableCell',
                  content: [inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' }],
                }
              }),
            })),
          }
        },
      },
    ],
  },
  serialize: {
    nodes: {
      table: (node, ctx) => {
        const rows = node.content ?? []
        const cols = Math.max(1, ...rows.map((r) => r.content?.length ?? 0))
        const align = (node.attrs?.align as Align[] | null) ?? null
        const children: MdRow[] = rows.map((row) => ({
          type: 'tableRow',
          children: Array.from({ length: cols }, (_, i) => ({
            type: 'tableCell',
            children: row.content?.[i] ? ctx.inline(cellText(row.content[i])) : [],
          })),
        }))
        return {
          type: 'table',
          align: align ? Array.from({ length: cols }, (_, i) => align[i] ?? null) : null,
          children,
        }
      },
    },
  },
  slash: [
    {
      id: 'table',
      title: 'Table',
      description: '3 x 3 table with a header row',
      keywords: ['table', 'grid', 'rows', 'columns'],
      icon: TableIcon,
      group: 'Advanced',
      run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
  ],
  toolbar: [
    {
      id: 'table',
      title: 'Table',
      icon: TableIcon,
      group: 'insert',
      isActive: (e) => e.isActive('table'),
      run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
  ],
  contexts: [{ id: 'table', when: (e) => e.isActive('table'), Component: TableBar }],
}
