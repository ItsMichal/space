import type { ReactNode } from 'react'

/**
 * A section of the index (`.ix-sec`, app/styles/type.css): its heading in the left column from 840px, the content beside it
 * at a book measure. The heading is named `${id}-h`. `aside` is a quiet line under the heading (a total, a span of years).
 * `level` 3 for a section inside another section (the home page's About).
 */
export function IndexSection({
  id,
  title,
  level = 2,
  aside,
  className = '',
  children,
}: {
  id: string
  title: ReactNode
  level?: 2 | 3
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  const H = level === 2 ? 'h2' : 'h3'
  const heading = (
    <H id={`${id}-h`} className="t-heading">
      {title}
    </H>
  )
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`ix-sec ${className}`.trim()}>
      {aside ? (
        <div className="ix-sec__head">
          {heading}
          <p className="t-meta">{aside}</p>
        </div>
      ) : (
        heading
      )}
      <div className="ix-sec__body">{children}</div>
    </section>
  )
}
