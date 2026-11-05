// Build time: put the cue file of each ::youtube and ::video with captions into the post's tree as text, so the page needs no
// request for it (the overlay parses it again). The file is read from public/media and checked with parseCaptions; a missing or
// bad file fails the build (scripts/content/validate.mjs reports it first). The renderer matched the path against CAPTIONS_SRC_RE.
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { CAPTIONS_SRC_RE, parseCaptions } from '@/lib/content/rules.mjs'

export async function inlineCaptions(tree: Root, publicDir = path.join(process.cwd(), 'public')): Promise<Root> {
  const nodes: Element[] = []
  visit(tree, 'element', (node) => {
    if ((node.tagName === 'mdx-youtube' || node.tagName === 'mdx-video') && node.properties?.captions) nodes.push(node)
  })
  for (const node of nodes) {
    const src = String(node.properties.captions)
    if (!CAPTIONS_SRC_RE.test(src)) throw new Error(`captions: bad src ${src.slice(0, 80)}`)
    const text = await fs.readFile(path.join(publicDir, src), 'utf8')
    const parsed = parseCaptions(text)
    if (!parsed.cues) throw new Error(`captions ${src}: ${parsed.problem}`)
    node.properties.vtt = text
  }
  return tree
}
