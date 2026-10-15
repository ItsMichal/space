'use client'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ImageOff, Trash2 } from 'lucide-react'

/** Figure with an inline caption (markdown title) and a required alt field (SEO + accessibility). */
export function ImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { src, alt, title } = node.attrs as { src: string; alt: string; title: string | null }
  const missing = !alt?.trim()
  return (
    <NodeViewWrapper as="figure" className={`ed-figure${selected ? ' is-selected' : ''}`}>
      <div className="ed-figure__media" contentEditable={false} data-drag-handle>
        <img src={src} alt={alt ?? ''} draggable={false} />
        <button type="button" className="ed-figure__remove" title="Remove image" aria-label="Remove image" onClick={deleteNode}>
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>
      <input
        className="ed-figure__caption"
        placeholder="Add a caption (optional)"
        value={title ?? ''}
        aria-label="Caption"
        onChange={(e) => updateAttributes({ title: e.target.value || null })}
      />
      <label className={`ed-figure__alt${missing ? ' is-missing' : ''}`}>
        <span>{missing ? <ImageOff size={13} strokeWidth={1.5} aria-hidden /> : null} Alt</span>
        <input
          value={alt ?? ''}
          placeholder="Describe the image for screen readers and search engines (required)"
          aria-label="Alt text"
          aria-invalid={missing}
          onChange={(e) => updateAttributes({ alt: e.target.value })}
        />
      </label>
    </NodeViewWrapper>
  )
}
