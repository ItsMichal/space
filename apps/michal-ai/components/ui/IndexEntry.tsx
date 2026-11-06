import Link from '@/lib/nav'
import type { ReactNode } from 'react'

/**
 * One entry of the index (`.ix`, app/styles/type.css): the title, a description, then a quiet secondary line (a date when
 * `dateTime` is given). A link when it has `href`, opening in a new tab when `external`; otherwise a plain block. `ui` drops
 * the title to body 500 inside an .ix-sec. The project entry with its picture is ProjectCard (components/work/Showcase.tsx).
 */
export function IndexEntry({
  href,
  external = false,
  title,
  desc,
  meta,
  dateTime,
  ui = false,
}: {
  href?: string
  external?: boolean
  title: ReactNode
  desc?: ReactNode
  meta?: ReactNode
  dateTime?: string
  ui?: boolean
}) {
  const className = ui ? 'ix ix--ui' : 'ix'
  const inner = (
    <>
      <span className="ix__title">{title}</span>
      {desc != null ? <span className="ix__desc">{desc}</span> : null}
      {meta == null ? null : dateTime ? (
        <time className="ix__meta" dateTime={dateTime}>
          {meta}
        </time>
      ) : (
        <span className="ix__meta">{meta}</span>
      )}
    </>
  )
  if (!href) return <div className={className}>{inner}</div>
  if (external)
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {inner}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  )
}
