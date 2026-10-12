import tokens from '../docs/design-system/tokens.json'
import { hashString } from '../components/shader-image/mask'

/**
 * Per-project palette tints, read from the design tokens (`tint-*` in docs/design-system/tokens.json). A project's tint
 * is picked by a stable hash of its slug, so a card and the hero atmosphere that follows its tagline always agree and
 * adding a project never recolours the others. A `tint` frontmatter field would override this if one is ever added.
 */
export type Tint = { name: string; hex: string }

export const TINTS: Tint[] = tokens.color.tokens
  .filter((t) => t.name.startsWith('tint-'))
  .map((t) => ({ name: t.name.slice(5), hex: (t.value as { light: string }).light }))

export const tintFor = (slug: string): Tint => TINTS[hashString('paper:' + slug) % TINTS.length]
