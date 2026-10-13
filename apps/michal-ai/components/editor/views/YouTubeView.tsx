'use client'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { parseYouTubeId } from '@/lib/editor/youtube'

export function YouTubeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const id = String(node.attrs.id ?? '')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(false)

  const commit = (value: string) => {
    const parsed = parseYouTubeId(value)
    if (!parsed) return setError(true)
    setError(false)
    updateAttributes({ id: parsed })
  }

  return (
    <NodeViewWrapper className={`ed-embed${selected ? ' is-selected' : ''}`} data-drag-handle>
      <div contentEditable={false}>
        {id ? (
          <div className="ed-embed__preview" style={{ aspectRatio: '16 / 9' }}>
            <img src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`} alt="" />
            <span className="ed-embed__play">
              <Play size={22} strokeWidth={1.5} aria-hidden />
            </span>
          </div>
        ) : null}
        <div className="ed-embed__bar">
          <span className="ed-embed__kind">YouTube</span>
          {id ? (
            <>
              <code>{id}</code>
              <input
                className="ed-embed__input"
                placeholder="Title (accessibility)"
                value={(node.attrs.title as string) ?? ''}
                onChange={(e) => updateAttributes({ title: e.target.value || null })}
              />
            </>
          ) : (
            <input
              className="ed-embed__input"
              autoFocus
              placeholder="Paste a YouTube link, then press Enter"
              aria-invalid={error}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit(draft))}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (parseYouTubeId(text)) {
                  e.preventDefault()
                  commit(text)
                }
              }}
            />
          )}
          <button type="button" className="ed-embed__remove" title="Remove" aria-label="Remove video" onClick={deleteNode}>
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
