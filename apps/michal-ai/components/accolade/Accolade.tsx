import { ArrowUpRight } from 'lucide-react'
import Link from '@/lib/nav'
import { Picture } from '@/components/media/Picture'
import { accoladeById, type AccoladeSource } from '@/content/accolades'
import './accolade.css'

const KIND_LABEL: Record<AccoladeSource['kind'], string> = {
  record: 'Record',
  tv: 'TV',
  news: 'Article',
  program: 'Programme',
}

/** "Oct 8, 2013" for a full date, "Oct 2013" when only the month is known. */
function when(iso: string) {
  const full = iso.length === 10
  return new Date(`${full ? iso : `${iso}-01`}T00:00:00Z`).toLocaleDateString(
    'en-US',
    {
      month: 'short',
      ...(full ? { day: 'numeric' } : {}),
      year: 'numeric',
      timeZone: 'UTC',
    }
  )
}

/**
 * An accolade card (content/accolades.ts): the quote from the record beside a picture of the document, then the coverage as
 * a scrolling row of link previews, most prominent outlet first. `story` links the post that tells the story (off inside
 * that post). An unknown id renders nothing.
 */
export function Accolade({
  id,
  story = true,
}: {
  id: string
  story?: boolean
}) {
  const a = accoladeById(id)
  if (!a) return null
  const headingId = `acc-${a.id}`
  return (
    <section className="acc" aria-labelledby={headingId}>
      <div className="acc__main">
        {a.document ? (
          <a
            className="acc__doc"
            href={a.quote.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Picture
              src={a.document.src}
              alt={a.document.alt}
              sizes="(min-width: 840px) 200px, 40vw"
              className="acc__docimg"
            />
            <span className="acc__doccap t-meta">{a.document.caption}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        <div className="acc__body">
          <p className="acc__eyebrow t-meta">{a.eyebrow}</p>
          <h3 id={headingId} className="acc__title t-ui">
            {a.title}, <time dateTime={a.year}>{a.year}</time>
          </h3>
          <figure className="acc__quote">
            <blockquote cite={a.quote.url}>
              <p>&ldquo;{a.quote.text}&rdquo;</p>
            </blockquote>
            <figcaption className="t-meta">
              <span className="acc__by">{a.quote.by}</span>, {a.quote.role}.{' '}
              <a
                href={a.quote.url}
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {a.quote.cite}
                <ArrowUpRight
                  size={13}
                  strokeWidth={1.5}
                  aria-hidden
                  className="acc__arrow"
                />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </figcaption>
          </figure>
          <p className="acc__summary t-text">{a.summary}</p>
          {story && a.postSlug ? (
            <Link
              href={`/writing/${a.postSlug}`}
              className="acc__story t-ui link"
            >
              Read the story
            </Link>
          ) : null}
        </div>
      </div>

      <div className="acc__press">
        <p className="acc__presshead t-meta">
          In the news <span aria-hidden>·</span> {a.sources.length} items
        </p>
        <ul className="acc__row" aria-label={`Coverage of ${a.title}`}>
          {a.sources.map((s) => (
            <li key={s.id}>
              <a
                className="acc__src"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                lang={s.lang}
              >
                <span className="acc__srctop t-meta">
                  <span className="acc__chip" data-kind={s.kind}>
                    {KIND_LABEL[s.kind]}
                  </span>
                  {s.lang === 'pl' ? (
                    <span className="acc__chip" lang="en">
                      Polish
                    </span>
                  ) : null}
                  <time dateTime={s.date}>{when(s.date)}</time>
                </span>
                <span className="acc__outlet t-ui">{s.outlet}</span>
                <span className="acc__headline">{s.title}</span>
                {s.titleEn ? (
                  <span className="acc__gloss t-meta" lang="en">
                    {s.titleEn}
                  </span>
                ) : s.note ? (
                  <span className="acc__gloss t-meta">{s.note}</span>
                ) : null}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
