// Build time: put each ::handwriting's ink file into the post's tree, so the prerendered page carries the finished ink as plain
// SVG (no request, no layout shift, readable without JavaScript) and the player animates it from there. The file is read from
// public/media and checked again with parseInk; a missing or bad file fails the build (scripts/content/validate.mjs reports
// it first). The src was matched against HANDWRITING_SRC_RE by the renderer, so it cannot leave public/media.
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { HANDWRITING_SRC_RE, parseInk } from '@/lib/content/rules.mjs'

export async function inlineHandwriting(tree: Root, publicDir = path.join(process.cwd(), 'public')): Promise<Root> {
  const nodes: Element[] = []
  visit(tree, 'element', (node) => {
    if (node.tagName === 'mdx-handwriting') nodes.push(node)
  })
  for (const node of nodes) {
    const src = String(node.properties?.src ?? '')
    if (!HANDWRITING_SRC_RE.test(src)) throw new Error(`handwriting: bad src ${src.slice(0, 80)}`)
    const parsed = parseInk(new Uint8Array(await fs.readFile(path.join(publicDir, src))))
    if (!parsed.ink) throw new Error(`handwriting ${src}: ${parsed.problem}`)
    node.properties.ink = JSON.stringify(parsed.ink)
  }
  return tree
}
