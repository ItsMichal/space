/*
 * Glass descriptors: the web twin of SwiftUI's `Glass` struct.
 *
 *   SwiftUI                         here
 *   .glassEffect(.regular)          effect={glass.regular}
 *   .regular.tint(.green)           glass.regular.tint('green')
 *   .regular.interactive()          glass.regular.interactive()
 *   .clear / .identity              glass.clear / glass.identity
 *
 * Descriptors are immutable: every chained call returns a copy.
 */

export type GlassVariant = 'regular' | 'clear' | 'identity'

export class Glass {
  readonly variant: GlassVariant
  /** Any CSS colour, including `var(--accent)`; resolved against the element at render time. */
  readonly tintColor: string | null
  readonly isInteractive: boolean

  constructor(variant: GlassVariant = 'regular', tintColor: string | null = null, isInteractive = false) {
    this.variant = variant
    this.tintColor = tintColor
    this.isInteractive = isInteractive
  }

  /** `.tint(_:)`. Pass null / undefined to remove. */
  tint(color?: string | null): Glass {
    return new Glass(this.variant, color ?? null, this.isInteractive)
  }

  /** `.interactive(_:)`: press scale with a spring, touch-point illumination. */
  interactive(on = true): Glass {
    return new Glass(this.variant, this.tintColor, on)
  }

  equals(o: Glass | null | undefined): boolean {
    return !!o && o.variant === this.variant && o.tintColor === this.tintColor && o.isInteractive === this.isInteractive
  }

  /** Stable key for effect hooks and caches. */
  get key(): string {
    return `${this.variant}|${this.tintColor ?? ''}|${this.isInteractive ? 1 : 0}`
  }
}

export const glass = {
  regular: new Glass('regular'),
  clear: new Glass('clear'),
  identity: new Glass('identity'),
} as const
