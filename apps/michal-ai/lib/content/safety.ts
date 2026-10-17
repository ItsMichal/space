// rehype plugin: the renderer's backstop for untrusted post bodies (posts live in the space-content repo, which the hosted editor
// can write to). The build already refuses content that breaks lib/content/rules.mjs; this makes sure that anything that slips
// through still renders inert. remark-rehype runs without allowDangerousHtml, so raw HTML in markdown never becomes markup; on top:
//   - only the known directives (::youtube, ::embed, ::callout) survive, with only their allowlisted attributes
//   - links keep their href only when it is http(s), mailto or relative; images need a /media/ or http(s) source
//   - no event handler, style or srcdoc attribute anywhere, and no element that can run or frame anything
import type { Element, Root, RootContent } from 'hast'
import { DIRECTIVES, directiveAttrs, safeHref, safeImageSrc } from './rules.mjs'

const BANNED = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'link', 'meta', 'form', 'textarea', 'select', 'button', 'svg', 'math', 'template', 'noscript', 'portal'])
const BAD_PROP = /^(on|style$|srcdoc$|formaction$|xlink|action$|background$|dynsrc$|lowsrc$|ping$)/i

function clean(node: Element): Element | null {
  const tag = node.tagName.toLowerCase()
  if (BANNED.has(tag)) return null
  const props = (node.properties ??= {})
  if (tag.startsWith('mdx-')) {
    const name = tag.slice(4)
    if (!DIRECTIVES[name]) return null
    const attrs = directiveAttrs(name, Object.fromEntries(Object.entries(props).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : v == null ? undefined : String(v)])))
    if (!attrs) return null
    node.properties = attrs
    return node
  }
  for (const k of Object.keys(props)) if (BAD_PROP.test(k)) delete props[k]
  if (tag === 'a' && props.href !== undefined && !safeHref(String(props.href))) delete props.href
  if (tag === 'img' && !safeImageSrc(String(props.src ?? ''))) return null
  if (tag === 'input' && props.type !== 'checkbox') return null // GFM task lists are the only inputs markdown makes
  return node
}

function walk(children: RootContent[]): RootContent[] {
  const out: RootContent[] = []
  for (const c of children) {
    if (c.type === 'raw') continue
    if (c.type === 'element') {
      const kept = clean(c)
      if (!kept) continue
      kept.children = walk(kept.children) as Element['children']
      out.push(kept)
    } else out.push(c)
  }
  return out
}

export function rehypeContentSafety() {
  return (tree: Root) => {
    tree.children = walk(tree.children)
  }
}
