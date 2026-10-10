'use client'

import { useEffect, useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { Glass } from './react'
import { glass, type Glass as GlassEffect } from './glass'
import type { GlassShape } from './geometry'
import type { GlassNamespace, GlassAppearance } from './engine'
import { getMemberField } from './engine'

export type GlassFoldProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  as?: ElementType
  effect?: GlassEffect
  shape?: GlassShape
  id?: string
  namespace?: GlassNamespace | null
  appearance?: GlassAppearance
  adaptiveText?: boolean
  /** Always-visible row (logo, title, toggle button). The panel hinges open from its bottom edge. */
  header: ReactNode
  /** Folding content. Wrap rows in <GlassFoldItem index={n}> to stagger them. */
  children?: ReactNode
  open: boolean
  panelId?: string
  /** Class for the header row wrapper. */
  headerClassName?: string
  /** Class for the panel's inner wrapper (padding etc.). */
  panelClassName?: string
}

/**
 * A glass surface that folds open: the shape grows downward from its header like the lower leaf of a
 * hinged screen, the rows inside unfold from their top edges with a short stagger, and a crease line
 * catches the light at the hinge. State in, so it is interruptible: toggling mid-flight reverses from
 * wherever it is (CSS transitions and the engine's springs both carry their velocity).
 * Total motion is under 400ms; reduced motion crossfades.
 */
export function GlassFold({
  header,
  children,
  open,
  panelId,
  headerClassName = '',
  panelClassName = '',
  effect = glass.regular,
  shape = { cornerRadius: 28 },
  ...rest
}: GlassFoldProps) {
  const el = useRef<HTMLElement | null>(null)
  const head = useRef<HTMLDivElement | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const node = el.current
    const field = node ? getMemberField(node) : null
    if (node && field && head.current) {
      const hostTop = node.offsetTop
      field.pulseFold(node, hostTop + head.current.offsetTop + head.current.offsetHeight + 0.5, 1)
    }
  }, [open])

  return (
    <Glass {...rest} effect={effect} shape={shape} ref={el} data-glass-fold={open ? 'open' : 'closed'}>
      <div ref={head} className={headerClassName}>
        {header}
      </div>
      <div id={panelId} className="glass-fold__panel" data-open={open ? '' : undefined} inert={!open}>
        <div className="glass-fold__inner">
          <div className={panelClassName}>{children}</div>
        </div>
      </div>
    </Glass>
  )
}

export function GlassFoldItem({
  index = 0,
  as: Tag = 'div',
  className = '',
  style,
  ...rest
}: HTMLAttributes<HTMLElement> & { index?: number; as?: ElementType }) {
  return (
    <Tag
      {...rest}
      className={`glass-fold-item${className ? ` ${className}` : ''}`}
      style={{ ['--i' as string]: index, ...style }}
    />
  )
}
