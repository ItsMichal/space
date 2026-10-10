import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { GalleryItem, PostLink } from '@/lib/content/types'
import { Zoomable } from '@/components/media/Zoomable'
import { Lightbox } from '@/components/media/Lightbox'

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
  links,
  gallery,
  kind,
  back,
  after,
  children,
}: Props) {
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
        <h1 className="text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em] md:text-display">
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
          {tags.length ? ` · ${tags.join(' · ')}` : null}
        </p>
      </header>
      {cover ? (
        <figure className={`hero ${kind === 'project' ? 'hero--bleed' : 'max-w-[900px]'}`}>
          <Zoomable
            src={cover}
            alt={coverAlt ?? ''}
            priority
            focus={coverFocus}
            className="hero__img"
            sizes={kind === 'project' ? '100vw' : '(min-width: 948px) 900px, calc(100vw - 32px)'}
          />
        </figure>
      ) : (
        <div className="h-space-12" />
      )}
      {kind === 'project' && (role || tags.length || links?.length) ? (
        <dl className="facts" aria-label="Project facts">
          <div>
            <dt>Year</dt>
            <dd>{date.slice(0, 4)}</dd>
          </div>
          {role ? (
            <div>
              <dt>Role</dt>
              <dd>{role}</dd>
            </div>
          ) : null}
          {tags.length ? (
            <div className="facts__wide">
              <dt>Stack</dt>
              <dd>{tags.join(' · ')}</dd>
            </div>
          ) : null}
          {links?.length ? (
            <div className="facts__wide">
              <dt>Links</dt>
              <dd>
                {links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label}
                    <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
                  </a>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {gallery?.length ? (
        <section className="gallery" aria-label="Gallery">
          <ul className="gallery__list">
            {gallery.map((g) => (
              <li key={g.src}>
                <figure className="gallery__item">
                  <Zoomable src={g.src} alt={g.alt} caption={g.caption} sizes="(min-width: 1184px) 340px, (min-width: 768px) 30vw, 82vw" />
                  {g.caption ? <figcaption>{g.caption}</figcaption> : null}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="prose">{children}</div>
      {after}
      <Lightbox />
    </article>
  )
}
