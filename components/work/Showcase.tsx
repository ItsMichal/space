import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Post } from '@/lib/content/types'
import { Picture } from '@/components/media/Picture'
import { ShaderImage } from '@/components/shader-image'

const FEAT_SIZES = '100vw'
const THUMB_SIZES = '(min-width: 768px) 176px, 104px'

const year = (p: Post) => p.years ?? p.date.slice(0, 4)

/** A featured project: full-bleed cinematic image, large title, serif spec line. */
function Feature({ post, href, priority, shader }: { post: Post; href: string; priority: boolean; shader: boolean }) {
  const Img = shader ? ShaderImage : Picture
  const meta = [year(post), post.role].filter(Boolean).join(' · ')
  return (
    <Link href={href} className="work-feat">
      <div className="work-feat__media">
        {post.cover ? (
          <Img
            src={post.cover}
            alt={post.coverAlt ?? ''}
            sizes={FEAT_SIZES}
            priority={priority}
            className="work-feat__img"
            focus={post.coverFocus}
          />
        ) : null}
      </div>
      <div className="work-feat__cap">
        <p className="work-feat__meta">
          {meta}
          <span className="work-feat__stack"> · {post.tags.filter((t) => t !== 'Web').slice(0, 3).join(', ')}</span>
        </p>
        <h3 className="work-feat__title">{post.title}</h3>
        <p className="work-feat__desc">{post.description}</p>
        <span className="work-feat__cta">
          View project <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden />
        </span>
      </div>
    </Link>
  )
}

/** An index row: year, title, description and an always-visible thumbnail (no hover-only reveals). */
function Row({ post, href, shader }: { post: Post; href: string; shader: boolean }) {
  const Img = shader ? ShaderImage : Picture
  const tags = post.tags.slice(0, 4)
  return (
    <Link href={href} className={`wrow${post.cover ? '' : ' wrow--bare'}`}>
      <p className="wrow__meta">
        {year(post)}
        <span className="wrow__mtags">{tags.slice(0, 2).map((t) => ` · ${t}`)}</span>
      </p>
      <div className="wrow__body">
        <h3 className="wrow__title">{post.title}</h3>
        <p className="wrow__desc">{post.description}</p>
      </div>
      <p className="wrow__tags">{tags.join(' · ')}</p>
      {post.cover ? (
        <div className="wrow__thumb">
          <Img src={post.cover} alt="" sizes={THUMB_SIZES} className="wrow__img" focus={post.coverFocus} />
        </div>
      ) : null}
    </Link>
  )
}

/**
 * Selected work, in the order given (best first). Featured projects (`featured: true`) are shown as large full-bleed
 * features in place; runs of other projects between them are index rows with thumbnails. `limit` caps the total number
 * of projects shown and adds an "all projects" link (home page).
 */
export function Showcase({ posts, base, limit, priority = false, shader = false }: { posts: Post[]; base: string; limit?: number; priority?: boolean; shader?: boolean }) {
  const shown = limit ? posts.slice(0, limit) : posts
  const blocks: ({ feature: Post } | { rows: Post[] })[] = []
  for (const p of shown) {
    if (p.featured) blocks.push({ feature: p })
    else {
      const last = blocks[blocks.length - 1]
      if (last && 'rows' in last) last.rows.push(p)
      else blocks.push({ rows: [p] })
    }
  }
  return (
    <div className="work">
      {blocks.map((b, i) =>
        'feature' in b ? (
          <div key={b.feature.slug} className="work-feat-wrap reveal">
            <Feature post={b.feature} href={`${base}/${b.feature.slug}`} priority={priority && i === 0} shader={shader} />
          </div>
        ) : (
          <ul key={b.rows[0].slug} className="work-index">
            {b.rows.map((p, j) => (
              <li key={p.slug} className="reveal" style={{ ["--i" as string]: j }}>
                <Row post={p} href={`${base}/${p.slug}`} shader={shader} />
              </li>
            ))}
          </ul>
        )
      )}
      {limit && posts.length > shown.length ? (
        <Link href={base} className="work-more link">
          All {posts.length} projects <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
        </Link>
      ) : null}
    </div>
  )
}
