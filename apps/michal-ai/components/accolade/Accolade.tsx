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

/** How many coverage rows show before "Show all": the most prominent first, the rest one press away. */
const LEAD = 6

/** "nbcnews.com" from a link, so a row says where it goes (the TV segments open on archive.org). */
function host(url: string) {
  return new URL(url).hostname.replace(/^www\./, '')
}

function Source({ s }: { s: AccoladeSource }) {
  return (
    <li>
      <a className="acc__src" href={s.url} target="_blank" rel="noopener noreferrer">
        <span className="acc__thumb" aria-hidden>
          {s.image ? <img src={s.image} alt="" width={320} height={180} loading="lazy" decoding="async" /> : null}
        </span>
        <span className="acc__outlet t-ui">{s.outlet}</span>
        <span className="acc__headline" lang={s.titleEn ? 'en' : s.lang}>
          {s.titleEn ?? s.title}
        </span>
        <span className="acc__srcmeta t-meta">
          {KIND_LABEL[s.kind]}
          {s.lang === 'pl' ? ', in Polish' : null} <span aria-hidden>·</span> <time dateTime={s.date}>{when(s.date)}</time>
        </span>
        <span className="acc__host t-meta">
          {host(s.url)}
          <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden className="acc__arrow" />
          <span className="sr-only"> (opens in a new tab)</span>
        </span>
      </a>
    </li>
  )
}

/**
 * An accolade card (content/accolades.ts): what it was (the eyebrow and title), then the document in its own column with,
 * beside it, the quote from it, one line of what happened and the coverage as a tidy list, the most prominent outlets
 * first and the rest behind "Show all". The scan is a tall page, so the text column runs its length rather than leaving
 * it alone; on phones it is cropped to its masthead. Inside a post the card takes the wide track. `story` links the post that tells the story (off inside that post).
 * An unknown id renders nothing.
 */
export function Accolade({ id, story = true }: { id: string; story?: boolean }) {
  const a = accoladeById(id)
  if (!a) return null
  const headingId = `acc-${a.id}`
  const lead = a.sources.slice(0, LEAD)
  const rest = a.sources.slice(LEAD)
  return (
    <section className="acc" aria-labelledby={headingId}>
      <header className="acc__head">
        <p className="acc__eyebrow t-meta">{a.eyebrow}</p>
        <h3 id={headingId} className="acc__title">
          {a.title}, <time dateTime={a.year}>{a.year}</time>
        </h3>
      </header>

      <div className="acc__main">
        {a.document ? (
          <figure className="acc__docfig">
            <a className="acc__doc" href={a.quote.url} target="_blank" rel="noopener noreferrer">
              <Picture src={a.document.src} alt={a.document.alt} sizes="(min-width: 840px) 280px, 60vw" className="acc__docimg" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <figcaption className="acc__doccap t-meta">{a.document.caption}</figcaption>
          </figure>
        ) : null}
        <div className="acc__body">
          <figure className="acc__quote">
            <blockquote cite={a.quote.url}>
              <p>&ldquo;{a.quote.text}&rdquo;</p>
            </blockquote>
            <figcaption className="t-meta">
              <span className="acc__by">{a.quote.by}</span>, {a.quote.role}.{' '}
              <a href={a.quote.url} className="link" target="_blank" rel="noopener noreferrer">
                {a.quote.cite}
                <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden className="acc__arrow" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </figcaption>
          </figure>
          <p className="acc__summary t-text">{a.summary}</p>
          {story && a.postSlug ? (
            <Link href={`/writing/${a.postSlug}`} className="acc__story t-ui link">
              Read the story
            </Link>
          ) : null}
        </div>
        {a.sources.length ? (
          <div className="acc__press">
            <h4 className="acc__presshead t-meta">
              Coverage <span aria-hidden>·</span> {a.sources.length} {a.sources.length === 1 ? 'item' : 'items'}
            </h4>
            <ul className="acc__list" aria-label={`Coverage of ${a.title}`}>
              {lead.map((s) => (
                <Source key={s.id} s={s} />
              ))}
            </ul>
            {rest.length ? (
              <details className="acc__more">
                <summary className="t-ui">
                  <span className="acc__more-open">Show all {a.sources.length}</span>
                  <span className="acc__more-close">Show fewer</span>
                </summary>
                <ul className="acc__list" aria-label={`More coverage of ${a.title}`}>
                  {rest.map((s) => (
                    <Source key={s.id} s={s} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
