import type { ReactNode } from 'react'

type Props = {
  title: string
  description: string
  date: string
  updated?: string
  tags: string[]
  readingMinutes: number
  cover?: string
  coverAlt?: string
  kind: 'project' | 'article'
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
  kind,
  children,
}: Props) {
  return (
    <article data-post className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <header className="max-w-[900px]">
        <p className="eyebrow mb-space-4">
          {kind} · {readingMinutes} min read
        </p>
        <h1 className="text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em] md:text-display">
          {title}
        </h1>
        <p className="lede mt-space-6 max-w-[40ch]">{description}</p>
        <p className="mt-space-6 font-mono text-meta text-ink-muted">
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
        <figure className="my-space-12 max-w-[900px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={coverAlt ?? ''} className="block h-auto w-full rounded-md bg-paper-sunk" />
        </figure>
      ) : (
        <div className="h-space-12" />
      )}
      <div className="prose">{children}</div>
    </article>
  )
}
