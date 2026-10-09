'use client'
import type { Editor } from '@tiptap/core'
import { ExternalLink, Link2Off, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { uiBus } from '@/lib/editor/ui-bus'
import { IconButton, useEditorTick } from './ui'

const normalise = (raw: string) => {
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(v)) return v
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`
  return `https://${v}`
}

/** Link editor: shows when the caret is in a link (view mode) or after Cmd+K / the toolbar button (edit mode). */
export function LinkPopover({ editor }: { editor: Editor }) {
  const tick = useEditorTick(editor)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [, force] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const href = (editor.getAttributes('link').href as string | undefined) ?? ''
  const inLink = editor.isActive('link')
  const hasSelection = !editor.state.selection.empty

  useEffect(
    () =>
      uiBus.on('link', () => {
        if (editor.state.selection.empty && !editor.isActive('link')) {
          uiBus.emit('toast', { message: 'Select some text to link first.' })
          return
        }
        setValue((editor.getAttributes('link').href as string | undefined) ?? '')
        setEditing(true)
      }),
    [editor]
  )

  useEffect(() => {
    const onScroll = () => force((n) => n + 1)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    if (editing) requestAnimationFrame(() => input.current?.select())
  }, [editing])

  // Leave edit mode when the selection moves somewhere else.
  const from = editor.state.selection.from
  useEffect(() => {
    if (!inLink && !hasSelection) setEditing(false)
  }, [from, inLink, hasSelection, tick])

  const visible = editing || (inLink && editor.isFocused && !hasSelection)
  if (!visible) return null

  let coords: { left: number; bottom: number }
  try {
    coords = editor.view.coordsAtPos(editor.state.selection.to)
  } catch {
    return null
  }

  const apply = () => {
    const url = normalise(value)
    const chain = editor.chain().focus().extendMarkRange('link')
    ;(url ? chain.setLink({ href: url }) : chain.unsetLink()).run()
    setEditing(false)
  }
  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setEditing(false)
  }

  return (
    <div
      className="ed-glass ed-link"
      role="dialog"
      aria-label="Edit link"
      style={{ left: Math.max(12, Math.min(coords.left, window.innerWidth - 380)), top: coords.bottom + 10 }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault()
      }}
    >
      {editing ? (
        <>
          <input
            ref={input}
            className="ed-link__input"
            placeholder="Paste or type a link"
            aria-label="Link URL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
                editor.commands.focus()
              }
            }}
          />
          <button type="button" className="ed-link__apply" onClick={apply}>
            Apply
          </button>
          {inLink ? <IconButton icon={Link2Off} title="Remove link" onClick={remove} /> : null}
        </>
      ) : (
        <>
          <a className="ed-link__href" href={href} target="_blank" rel="noreferrer">
            {href}
          </a>
          <IconButton
            icon={Pencil}
            title="Edit link"
            onClick={() => {
              setValue(href)
              setEditing(true)
            }}
          />
          <IconButton icon={ExternalLink} title="Open link" onClick={() => window.open(href, '_blank', 'noopener')} />
          <IconButton icon={Link2Off} title="Remove link" onClick={remove} />
        </>
      )}
    </div>
  )
}
