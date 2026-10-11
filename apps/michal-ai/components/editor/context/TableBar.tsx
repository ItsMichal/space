'use client'
import type { Editor } from '@tiptap/core'
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Rows3,
  Table2,
  Trash2,
} from 'lucide-react'
import { Divider, IconButton } from '../ui'

export function TableBar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus()
  return (
    <>
      <span className="ed-ctx-label">Table</span>
      <IconButton icon={ArrowUpToLine} title="Add row above" onClick={() => c().addRowBefore().run()} />
      <IconButton icon={ArrowDownToLine} title="Add row below" onClick={() => c().addRowAfter().run()} />
      <IconButton icon={Trash2} label="Row" title="Delete row" onClick={() => c().deleteRow().run()} />
      <Divider />
      <IconButton icon={ArrowLeftToLine} title="Add column before" onClick={() => c().addColumnBefore().run()} />
      <IconButton icon={ArrowRightToLine} title="Add column after" onClick={() => c().addColumnAfter().run()} />
      <IconButton icon={Trash2} label="Column" title="Delete column" onClick={() => c().deleteColumn().run()} />
      <Divider />
      <IconButton icon={Rows3} title="Toggle header row" onClick={() => c().toggleHeaderRow().run()} />
      <IconButton icon={Table2} label="Delete" title="Delete table" onClick={() => c().deleteTable().run()} />
    </>
  )
}
