import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { GalleryItem, PostLink } from '@/lib/content/types'
import { Zoomable } from '@/components/media/Zoomable'
import { Lightbox } from '@/components/media/Lightbox'
import { Gallery } from '@/components/ui/Gallery'
import { FactRows } from '@/components/ui/FactRows'
import { ReadingToc } from '@/components/ui/ReadingToc'

type Props = {
  title: string
  description: string
  date: string
  updated?: string
  tags: string[]
  readingMinutes: number
  cover?: string
  coverAlt?: string
  coverFocus?: string
  role?: string
  years?: string
  links?: PostLink[]
  gallery?: GalleryItem[]
  kind: 'project' | 'article'
  back?: { href: string; label: string; series?: string }
  after?: ReactNode
  children: ReactNode
}

const fmt = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

export function ArticleLayout({
  title,
  description,
  date,
  updated,
  tags,
  readingMinutes,
  cover,
  coverAlt,
  coverFocus,
  role,
  years,
  links,
  gallery,
  kind,
  back,
  after,
  children,
}: Props) {
  // "Web" is a category, not a stack item: it never leads a spec line.
  const stack = tags.filter((t) => t !== 'Web')
  return (
    <article data-post className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <header className="max-w-[900px]">
        {back ? (
          <p className="mb-space-4 font-serif text-[16px] text-ink-muted">
            <Link href={back.href} className="link inline-flex min-h-[44px] items-center">
              {back.label}
            </Link>
            {back.series ? ` · ${back.series}` : ''} · {readingMinutes} min read
          </p>
        ) : (
          <p className="mb-space-4 font-serif text-[16px] text-ink-muted">
            {kind === 'project' ? 'Project' : 'Article'} · {readingMinutes} min read
          </p>
        )}
        <h1 className="font-display text-[clamp(46px,13vw,60px)] font-normal leading-none tracking-[-0.02em] md:text-display">
          {title}
        </h1>
        <p className="lede mt-space-6 max-w-[40ch]">{description}</p>
        <p className="mt-space-6 font-serif text-[16px] italic text-ink-muted">
          <time dateTime={date}>{fmt(date)}</time>
          {updated && updated !== date ? (
            <>
              {' · updated '}
              <time dateTime={updated}>{fmt(updated)}</time>
            </>
          ) : null}
          {stack.length ? ` · ${stack.join(' · ')}` : null}
        </p>
      </header>
      {cover ? (
        <figure className="hero max-w-[900px]">
          <Zoomable
            src={cover}
            alt={coverAlt ?? ''}
            priority
            focus={coverFocus}
            className="hero__img"
            sizes="(min-width: 948px) 900px, calc(100vw - 32px)"
          />
        </figure>
      ) : (
        <div className="h-space-12" />
      )}
      {kind === 'project' && (role || stack.length || links?.length) ? (
        <FactRows
          facts={[
            { label: 'Year', value: years ?? date.slice(0, 4) },
            ...(role ? [{ label: 'Role', value: role }] : []),
            ...(stack.length ? [{ label: 'Stack', value: stack.join(' · ') }] : []),
            ...(links?.length
              ? [
                  {
                    label: 'Links',
                    value: links.map((l) => (
                      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                        {l.label}
                        <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
                      </a>
                    )),
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      {gallery?.length ? (
        <section className="gallery" aria-label="Gallery">
          <Gallery
            label="Project images"
            autoplayMs={0}
            slides={gallery.map((g) => ({
              key: g.src,
              caption: g.caption,
              node: <Zoomable src={g.src} alt={g.alt} caption={g.caption} sizes="(min-width: 900px) 760px, 90vw" />,
            }))}
          />
        </section>
      ) : null}
      <div className="prose">{children}</div>
      {after}
      <ReadingToc />
      <Lightbox />
    </article>
  )
}
