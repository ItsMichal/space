// Build-time markdown -> React. Runs in server components that are statically generated.
import type { ReactNode } from 'react'
import { hastToReact } from './to-react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import { visit } from 'unist-util-visit'
import type { Root } from 'hast'
import { LIVE_BLOCK_REACTIONS } from '@/lib/presence/flag'
import { blockIds } from '@/lib/presence/blocks'
import { rehypeDropDeadEmbeds } from '@/lib/embeds'

// Turn directive nodes into hast elements with custom tag names that we map to components.
// Only leaf (`::name`) and container (`:::name`) directives are components; inline `:name` text
// directives are not part of the content format and mostly appear by accident ("10:30"), so they
// are turned back into the literal text they came from.
type DirectiveNode = {
  type: string
  name?: string
  attributes?: Record<string, string>
  data?: Record<string, unknown>
  children?: unknown[]
}
function remarkDirectiveToHast() {
  return (tree: Root) => {
    visit(tree as never, 'textDirective', (node: DirectiveNode, index?: number, parent?: { children: unknown[] }) => {
      if (!parent || index === undefined) return
      parent.children.splice(index, 1, { type: 'text', value: `:${node.name}` }, ...(node.children ?? []))
      return index + 1
    })
    visit(tree as never, (node: DirectiveNode) => {
      if (node.type === 'leafDirective' || node.type === 'containerDirective') {
        const data = node.data || (node.data = {})
        data.hName = `mdx-${node.name}`
        data.hProperties = { ...(node.attributes || {}) }
      }
    })
  }
}

// <p><img></p> -> <img> so the figure mapping doesn't nest <figure> inside <p>.
function rehypeUnwrapImages() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'p' || !parent || index === undefined) return
      const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()))
      if (kids.length === 1 && kids[0].type === 'element' && kids[0].tagName === 'img') {
        parent.children[index] = kids[0]
      }
    })
  }
}

// Stable ids on paragraphs and h2-h4 so highlight reactions can attach to them (see lib/presence/blocks.ts for the trade-off).
// Plain data attributes: invisible to readers and crawlers. Paragraphs shorter than 24 characters and captions are skipped.
function rehypeBlockIds() {
  const textOf = (n: { type: string; value?: string; children?: unknown[] }): string =>
    n.type === 'text' ? (n.value ?? '') : ((n.children ?? []) as (typeof n)[]).map(textOf).join('')
  return (tree: Root) => {
    const blocks: { props: Record<string, unknown>; text: string }[] = []
    visit(tree, 'element', (node, _i, parent) => {
      if (!['p', 'h2', 'h3', 'h4'].includes(node.tagName)) return
      if (parent && 'tagName' in parent && ['figure', 'figcaption'].includes(parent.tagName as string)) return
      const text = textOf(node as never).trim()
      if (text.length < 24 && node.tagName === 'p') return
      if (!text) return
      blocks.push({ props: (node.properties ??= {}), text })
    })
    const ids = blockIds(blocks.map((b) => b.text))
    blocks.forEach((b, i) => {
      b.props['data-block'] = ids[i]
    })
  }
}

/** Markdown to the final hast tree (plain JSON: no positions), ready to cross the loader boundary. */
export async function markdownToHast(source: string): Promise<Root> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkDirectiveToHast)
    .use(remarkRehype)
    .use(rehypeUnwrapImages)
    .use(rehypeDropDeadEmbeds)
    .use(rehypeSlug)
    .use(LIVE_BLOCK_REACTIONS ? rehypeBlockIds : () => () => {})
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypePrettyCode, {
      theme: { light: 'github-light', dark: 'github-dark' },
      keepBackground: false,
    })
  const file = (await processor.run(processor.parse(source))) as Root
  return JSON.parse(JSON.stringify(file, (k, v) => (k === 'position' ? undefined : v))) as Root
}

export async function renderMarkdown(source: string): Promise<ReactNode> {
  return hastToReact(await markdownToHast(source))
}
