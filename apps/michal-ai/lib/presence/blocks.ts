// Stable ids for paragraphs and headings, used to key highlight reactions.
//
// id = 5 base36 chars of a hash of the block's normalised text (lowercased, whitespace collapsed, first 240 chars),
// plus "-N" for the Nth repeat of identical text within one post.
//
// Trade-off: the id follows the text, not the position. Inserting, removing or reordering other blocks keeps every
// reaction attached to its paragraph. Editing the first ~240 characters of a block changes its id and orphans that
// block's reactions (they stay stored, but are no longer shown). A position-based index would survive edits but silently
// move reactions onto the wrong paragraph when blocks are added, which is worse. 36^5 ids make accidental collisions
// between different paragraphs rare (about 1 in 60 million per pair).
import { hash32 } from './geo'

export function normaliseBlock(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 240)
}

export function blockId(text: string): string {
  return (hash32(normaliseBlock(text)) % 60_466_176).toString(36).padStart(5, '0')
}

/** Ids for a post's blocks, in document order. */
export function blockIds(texts: readonly string[]): string[] {
  const seen = new Map<string, number>()
  return texts.map((t) => {
    const base = blockId(t)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}-${n}`
  })
}
