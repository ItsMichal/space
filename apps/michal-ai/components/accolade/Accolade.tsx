'use client'

import { useId, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { fullDate } from '@/lib/dates'
import { Collapse, Swap } from '@/components/stageshow/kit'
import Link from '@/lib/nav'
import { ExternalLink } from '@/components/ui/ExternalLink'
import { accoladeById, type AccoladeSource } from '@/content/accolades'
import './accolade.css'

const KIND_LABEL: Record<AccoladeSource['kind'], string> = {
  record: 'Record',
  tv: 'TV',
  news: 'Article',
  program: 'Programme',
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
        {/* no picture of its own survives: the outlet's name set on paper, so the row never borrows another item's image */}
        <span className={s.image ? 'acc__thumb' : 'acc__thumb acc__thumb--name'} aria-hidden>
          {s.image ? <img src={s.image} alt="" width={320} height={180} loading="lazy" decoding="async" /> : s.outlet}
        </span>
        <span className="acc__outlet t-ui">{s.outlet}</span>
        <span className="acc__headline" lang={s.titleEn ? 'en' : s.lang}>
          {s.titleEn ?? s.title}
        </span>
        <span className="acc__srcmeta t-meta">
          {KIND_LABEL[s.kind]}
          {s.lang === 'pl' ? ', in Polish' : null} <span aria-hidden>·</span> <time dateTime={s.date}>{fullDate(s.date)}</time>
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
 * An accolade card (content/accolades.ts): what it was (the eyebrow and title), then the quote, one line of what happened and
 * the coverage as a tidy list, the most prominent outlets first and the rest behind "Show all". Inside a post the card takes
 * the wide track. `story` links the post that tells the story (off inside that post); `quote` off drops the quote where the
 * page already gives the passage in full (the post's :::quote). "Show all" opens the rest with the Stageshow kit's Collapse, the
 * label swapping in place. An unknown id renders nothing.
 */
export function Accolade({ id, story = true, quote = true }: { id: string; story?: boolean; quote?: boolean }) {
  const a = accoladeById(id)
  const [open, setOpen] = useState(false)
  const moreId = useId()
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
        <div className="acc__body">
          {quote ? (
            <figure className="acc__quote">
              <blockquote cite={a.quote.url}>
                <p>&ldquo;{a.quote.text}&rdquo;</p>
              </blockquote>
              <figcaption className="t-meta">
                <span className="acc__by">{a.quote.by}</span>, {a.quote.role}.{' '}
                <ExternalLink href={a.quote.url}>{a.quote.cite}</ExternalLink>
              </figcaption>
            </figure>
          ) : null}
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
              <>
                <Collapse open={open} id={moreId} inert={!open} className="acc__more">
                  <ul className="acc__list" aria-label={`More coverage of ${a.title}`}>
                    {rest.map((s) => (
                      <Source key={s.id} s={s} />
                    ))}
                  </ul>
                </Collapse>
                <button type="button" className="acc__toggle t-ui" aria-expanded={open} aria-controls={moreId} onClick={() => setOpen((o) => !o)}>
                  <Swap id={open ? 'fewer' : 'all'}>{open ? 'Show fewer' : `Show all ${a.sources.length}`}</Swap>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
