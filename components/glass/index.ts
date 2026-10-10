/*
 * Liquid Glass for the web. SwiftUI -> here is mapped in ./README.md.
 */
export { Glass as GlassEffect, glass } from './glass'
export { shapes, type GlassShape } from './geometry'
export {
  Glass,
  GlassEffectContainer,
  useGlassNamespace,
  type GlassProps,
  type GlassEffectContainerProps,
} from './react'
export { glassButton, type GlassButtonStyle } from './glassButtonStyle'
export { GlassFold, GlassFoldItem } from './fold'
export { LiquidGlass } from './LiquidGlass'
export { GlassButton } from './GlassButton'
export { enableGlassMotion, motionNeedsGesture } from './lighting'
export { getGlassStats, resetGlassStats, GlassNamespace } from './engine'
export type { GlassTransition, GlassAppearance, GlassEngineMode } from './engine'
