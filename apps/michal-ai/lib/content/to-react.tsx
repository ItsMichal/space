// hast -> React with the site's component map. Browser-safe: the markdown toolchain (unified, remark, rehype, shiki) lives in ./render
// and runs in the loaders; only this small converter ships to the browser.
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { ReactNode } from 'react'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Root } from 'hast'
import { YouTube } from '@/components/mdx/YouTube'
import { Embed } from '@/components/mdx/Embed'
import { Callout } from '@/components/mdx/Callout'
import { Handwriting, type HandwritingProps } from '@/components/mdx/Handwriting'
import { Picture } from '@/components/media/Picture'
import { Zoomable } from '@/components/media/Zoomable'
import { PostPreviewLink } from '@/components/ui/PostPreviewLink'

type Props = Record<string, unknown>

const components = {
  a: (p: Props & { children?: ReactNode }) => <PostPreviewLink {...(p as { href?: string; children?: ReactNode })} />,
  'mdx-youtube': (p: Props) => <YouTube id={String(p.id)} title={p.title as string | undefined} />,
  'mdx-embed': (p: Props) => <Embed url={String(p.url)} title={p.title as string | undefined} ratio={p.ratio as string | undefined} />,
  'mdx-callout': (p: Props & { children?: ReactNode }) => <Callout type={(p.type as string) ?? 'note'}>{p.children}</Callout>,
  'mdx-handwriting': (p: Props) => <Handwriting {...(p as HandwritingProps)} />,
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

export function hastToReact(tree: Root): ReactNode {
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components: components as never,
  })
}
