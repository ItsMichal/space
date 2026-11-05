// Build time: put each ::map's drawing into the post's tree (like lib/ink/inline.server.ts does for handwriting), so the
// prerendered page carries the map as plain SVG and only the posts that use a map pay for its geometry. An unknown id is
// left alone; the component renders nothing for it.
import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { mapById } from '@/content/maps'
import * as world from './world.gen'
import { mapGeometry } from './geometry'

export function inlineMaps(tree: Root): Root {
  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'mdx-map') return
    const data = mapById(String(node.properties?.id ?? ''))
    if (data) node.properties.geo = JSON.stringify(mapGeometry(data, world))
  })
  return tree
}
