'use client'
import type { Editor } from '@tiptap/core'
import { IconButton } from '../ui'

const TYPES = ['note', 'tip', 'warning', 'danger']

export function CalloutBar({ editor }: { editor: Editor }) {
  const current = editor.getAttributes('callout').type as string
  return (
    <>
      <span className="ed-ctx-label">Callout</span>
      {TYPES.map((t) => (
        <IconButton
          key={t}
          label={t}
          title={`${t} callout`}
          active={current === t}
          onClick={() => editor.chain().focus().updateAttributes('callout', { type: t }).run()}
        />
      ))}
      <IconButton label="Unwrap" title="Remove callout" onClick={() => editor.chain().focus().lift('callout').run()} />
    </>
  )
}
