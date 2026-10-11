'use client'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

/** Markdown the editor has no block for. Kept verbatim and editable as source. */
export function RawView({ node, updateAttributes, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper className={`ed-raw${selected ? ' is-selected' : ''}`} data-drag-handle>
      <div contentEditable={false}>
        <span className="ed-embed__kind">Markdown (kept as written)</span>
        <textarea
          value={String(node.attrs.source ?? '')}
          spellCheck={false}
          rows={Math.min(12, String(node.attrs.source ?? '').split('\n').length + 1)}
          onChange={(e) => updateAttributes({ source: e.target.value })}
        />
      </div>
    </NodeViewWrapper>
  )
}
