'use client'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

export function EmbedView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const url = String(node.attrs.url ?? '')
  const [draft, setDraft] = useState(url)
  const valid = /^https:\/\//.test(url)
  const commit = () => {
    const v = draft.trim()
    if (/^https:\/\/\S+$/.test(v)) updateAttributes({ url: v })
  }
  return (
    <NodeViewWrapper className={`ed-embed${selected ? ' is-selected' : ''}`} data-drag-handle>
      <div contentEditable={false}>
        {valid ? (
          <div className="ed-embed__preview" style={{ aspectRatio: String(node.attrs.ratio ?? '16 / 9') }}>
            <iframe
              src={url}
              title={(node.attrs.title as string) ?? 'Embedded content'}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              tabIndex={-1}
            />
          </div>
        ) : null}
        <div className="ed-embed__bar">
          <span className="ed-embed__kind">Embed</span>
          <input
            className="ed-embed__input"
            autoFocus={!url}
            placeholder="https:// URL, then press Enter (https only)"
            aria-invalid={Boolean(draft) && !/^https:\/\/\S+$/.test(draft.trim())}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
          />
          <input
            className="ed-embed__input ed-embed__input--narrow"
            placeholder="Ratio 16 / 9"
            aria-label="Aspect ratio"
            value={(node.attrs.ratio as string) ?? ''}
            onChange={(e) => updateAttributes({ ratio: e.target.value || null })}
          />
          <button type="button" className="ed-embed__remove" title="Remove" aria-label="Remove embed" onClick={deleteNode}>
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
