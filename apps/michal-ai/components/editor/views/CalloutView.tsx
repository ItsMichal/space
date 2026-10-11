'use client'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export function CalloutView({ node }: NodeViewProps) {
  const type = String(node.attrs.type ?? 'note')
  return (
    <NodeViewWrapper as="aside" className={`callout callout--${type}`} data-callout={type}>
      <span className="callout__tag" contentEditable={false}>
        {type}
      </span>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}
