// Build-time markdown -> React. Runs in server components that are statically generated.
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { ReactNode } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import { visit } from 'unist-util-visit'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Root } from 'hast'
import { YouTube } from '@/components/mdx/YouTube'
import { Embed } from '@/components/mdx/Embed'
import { Callout } from '@/components/mdx/Callout'
import { Picture } from '@/components/media/Picture'
import { Zoomable } from '@/components/media/Zoomable'
import { PostPreviewLink } from '@/components/ui/PostPreviewLink'
import { LIVE_BLOCK_REACTIONS } from '@/lib/presence/flag'
import { blockIds } from '@/lib/presence/blocks'

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

type Props = Record<string, unknown>

const components = {
  a: (p: Props & { children?: ReactNode }) => <PostPreviewLink {...(p as { href?: string; children?: ReactNode })} />,
  'mdx-youtube': (p: Props) => <YouTube id={String(p.id)} title={p.title as string | undefined} />,
  'mdx-embed': (p: Props) => <Embed url={String(p.url)} title={p.title as string | undefined} ratio={p.ratio as string | undefined} />,
  'mdx-callout': (p: Props & { children?: ReactNode }) => <Callout type={(p.type as string) ?? 'note'}>{p.children}</Callout>,
  // A wide table scrolls sideways inside its own wrapper (a focusable region), and the <table> keeps its semantics.
  table: (p: Props & { children?: ReactNode }) => (
    <div className="table-scroll" role="region" aria-label="Table" tabIndex={0}>
      <table>{p.children}</table>
    </div>
  ),
  img: (p: Props) => {
    const { src, alt, title } = p as { src?: string; alt?: string; title?: string }
    if (!src) return null
    const sizes = '(min-width: 768px) 720px, calc(100vw - 32px)'
    return (
      <figure>
        {src.startsWith('/media/') ? (
          <Zoomable src={src} alt={alt ?? ''} sizes={sizes} caption={title} />
        ) : (
          <Picture src={src} alt={alt ?? ''} sizes={sizes} />
        )}
        {title ? <figcaption>{title}</figcaption> : null}
      </figure>
    )
  },
}

export async function renderMarkdown(source: string): Promise<ReactNode> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkDirectiveToHast)
    .use(remarkRehype)
    .use(rehypeUnwrapImages)
    .use(rehypeSlug)
    .use(LIVE_BLOCK_REACTIONS ? rehypeBlockIds : () => () => {})
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypePrettyCode, {
      theme: { light: 'github-light', dark: 'github-dark' },
      keepBackground: false,
    })
  const file = await processor.run(processor.parse(source))
  return toJsxRuntime(file as Root, {
    Fragment,
    jsx,
    jsxs,
    components: components as never,
  })
}
