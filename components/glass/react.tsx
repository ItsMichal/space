'use client'

import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'
import './glass.css'
import { Glass as GlassEffect, glass } from './glass'
import type { GlassShape } from './geometry'
import {
  GlassNamespace,
  attachContainer,
  attachMember,
  type Attached,
  type FieldOptions,
  type GlassAppearance,
  type GlassEngineMode,
  type GlassTransition,
  type MemberConfig,
} from './engine'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// ---------------------------------------------------------------- namespace

/** `@Namespace`: scopes glassEffectID so ids only match inside one namespace. */
export function useGlassNamespace(name = 'glass'): GlassNamespace {
  return useMemo(() => new GlassNamespace(name), [name])
}

// ---------------------------------------------------------------- container

export type GlassEffectContainerProps = HTMLAttributes<HTMLElement> & {
  /** `GlassEffectContainer(spacing:)`. Shapes closer than this start to blend; at about half of it they fuse. Default 24. */
  spacing?: number
  /** Rendering path. 'auto' picks the SVG backdrop path on Chromium and the lidar-sampling path elsewhere. */
  engine?: GlassEngineMode
  as?: ElementType
  /** Rim width in px. Default: median corner radius, clamped to 8..24. */
  bezel?: number
  /** Lens strength (css px scale). Default var(--glass-refraction). */
  refraction?: number
  /** Frost in px. Default var(--glass-blur). */
  blur?: number
  /** Backdrop saturation. Default var(--glass-saturate). */
  saturate?: number
  children?: ReactNode
  ref?: Ref<HTMLElement>
}

/**
 * `GlassEffectContainer`: every `<Glass>` inside it renders into one shared field, so nearby shapes
 * merge liquidly and morph into each other. Up to 12 shapes per container.
 */
export function GlassEffectContainer({
  spacing = 24,
  engine = 'auto',
  as,
  bezel,
  refraction,
  blur,
  saturate,
  className = '',
  children,
  ref,
  ...rest
}: GlassEffectContainerProps) {
  const el = useRef<HTMLElement | null>(null)
  const handle = useRef<ReturnType<typeof attachContainer> | null>(null)
  const opts: FieldOptions = { spacing, engine, bezel, refraction, blur, saturate }
  const optsRef = useRef(opts)
  optsRef.current = opts

  useIsoLayoutEffect(() => {
    const host = el.current
    if (!host) return
    handle.current = attachContainer(host, optsRef.current)
    return () => {
      handle.current?.detach()
      handle.current = null
    }
  }, [])

  useIsoLayoutEffect(() => {
    handle.current?.update(opts)
  }, [spacing, engine, bezel, refraction, blur, saturate])

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      el.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: HTMLElement | null }).current = node
    },
    [ref],
  )

  return createElement(
    as ?? 'div',
    { ...rest, ref: setRef, 'data-glass-container': '', className: `glass-container${className ? ` ${className}` : ''}` },
    children,
  )
}

// ---------------------------------------------------------------- Glass member

export type GlassProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  /** `.glassEffect(_:in:)`: the variant, tint and interactivity. Default `glass.regular`. */
  effect?: GlassEffect
  /** The shape the effect is drawn in. Default 'capsule' (SwiftUI's default). */
  shape?: GlassShape
  /** `.glassEffectID(_:in:)`: with `namespace`, lets shapes morph into each other across renders. */
  id?: string
  namespace?: GlassNamespace | null
  /** `.glassEffectUnion(id:namespace:)`: members with the same id fuse into one shape. */
  unionId?: string
  /** `.glassEffectTransition(_:)`. Default 'matchedGeometry' when `id` + `namespace` are set, else 'materialize'. */
  transition?: GlassTransition
  /** 'auto' flips between light and dark glass based on what is behind it. */
  appearance?: GlassAppearance
  /** Flip the text colour with the glass tone (Apple flips glyphs on regular glass). Default false. */
  adaptiveText?: boolean
  /** Standalone use only (no container): per-field overrides, kept for LiquidGlass compatibility. */
  bezel?: number
  refraction?: number
  blur?: number
  saturate?: number
  engine?: GlassEngineMode
  children?: ReactNode
  ref?: Ref<HTMLElement>
  [attr: string]: unknown
}

export function shapeRadiusCss(shape: GlassShape): string | undefined {
  if (shape === 'capsule' || shape === 'circle') return '9999px'
  if (shape === 'rect') return '0px'
  if (shape === 'containerConcentric' || shape === 'inherit') return undefined
  return `${shape.cornerRadius}px`
}

/**
 * `.glassEffect(_:in:)` as a component. Inside a `GlassEffectContainer` it contributes its shape to the
 * container's field; on its own it is a one-shape field.
 */
export function Glass({
  as,
  effect = glass.regular,
  shape = 'capsule',
  id,
  namespace = null,
  unionId,
  transition,
  appearance = 'auto',
  adaptiveText = false,
  bezel,
  refraction,
  blur,
  saturate,
  engine,
  className = '',
  style,
  children,
  ref,
  ...rest
}: GlassProps) {
  const el = useRef<HTMLElement | null>(null)
  const handle = useRef<Attached | null>(null)
  const tr: GlassTransition = transition ?? (id && namespace ? 'matchedGeometry' : 'materialize')
  const cfg: MemberConfig = { effect, shape, id, namespace, union: unionId ?? null, transition: tr, appearance }
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg
  const standaloneOpts: FieldOptions = { bezel, refraction, blur, saturate, engine }
  const optsRef = useRef(standaloneOpts)
  optsRef.current = standaloneOpts

  useIsoLayoutEffect(() => {
    const node = el.current
    if (!node) return
    handle.current = attachMember(node, cfgRef.current, optsRef.current)
    return () => {
      handle.current?.detach()
      handle.current = null
    }
  }, [])

  // config changes (tint, interactive, shape, ids) update the member in place
  const shapeKey = typeof shape === 'string' ? shape : `r${shape.cornerRadius}`
  useIsoLayoutEffect(() => {
    handle.current?.update(cfgRef.current)
  }, [effect.key, shapeKey, id, namespace, unionId, tr, appearance])

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      el.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: HTMLElement | null }).current = node
    },
    [ref],
  )

  const radius = shapeRadiusCss(shape)
  const cls = `glass${effect.variant === 'identity' ? '' : ' lg'}${className ? ` ${className}` : ''}`
  return createElement(
    as ?? 'div',
    {
      ...rest,
      ref: setRef,
      className: cls,
      style: radius ? { borderRadius: radius, ...style } : style,
      'data-glass-member': '',
      'data-glass-variant': effect.variant,
      ...(adaptiveText ? { 'data-glass-adaptive-text': '' } : null),
    },
    children,
  )
}

export { glass }
