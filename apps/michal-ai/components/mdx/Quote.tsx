'use client'

import { Children, isValidElement, useId, useState, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Collapse, Swap } from '@/components/stageshow/kit'
import './quote.css'

export type QuoteProps = { title?: string; by?: string; role?: string; date?: string; cite?: string; url?: string; children?: ReactNode }

/** "Thursday, July 3, 2014" from 2014-07-03. */
function longDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "govinfo.gov" from a link, or null when it does not parse. */
function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * :::quote{title by role date cite url} ... ::: a long passage quoted in full (a speech, a record, a letter). The heading says
 * what it is and who said it when; the first paragraph shows, the rest opens under it with "Read the full text" (the Stageshow
 * kit's Collapse, so the text below moves with the opening height and the label swaps in place; inert while closed). The cite is
 * the eyebrow; a link to the original closes the card. Every attribute is optional.
 */
export function Quote({ title, by, role, date, cite, url, children }: QuoteProps) {
  // the paragraphs, without the whitespace text between them
  const blocks = Children.toArray(children).filter((c) => isValidElement(c))
  const [lead, ...rest] = blocks
  const byline = [by, role].filter(Boolean).join(' ')
  const source = url ? host(url) : null
  const [open, setOpen] = useState(false)
  const restId = useId()
  return (
    <figure className="rq">
      {cite || title || byline || date ? (
        <header className="rq__head">
          {cite ? <p className="rq__eyebrow t-meta">{cite}</p> : null}
          {title ? <p className="rq__title">{title}</p> : null}
          {byline || date ? (
            <p className="rq__by t-meta">
              {byline}
              {byline && date ? <span aria-hidden> · </span> : null}
              {date ? <time dateTime={date}>{longDate(date)}</time> : null}
            </p>
          ) : null}
        </header>
      ) : null}
      <blockquote className="rq__text" cite={url}>
        {lead}
        {rest.length ? (
          <>
            <Collapse open={open} id={restId} inert={!open} className="rq__rest">
              {rest}
            </Collapse>
            <button type="button" className="rq__more t-ui" aria-expanded={open} aria-controls={restId} onClick={() => setOpen((o) => !o)}>
              <Swap id={open ? 'less' : 'more'}>{open ? 'Show less' : 'Read the full text'}</Swap>
            </button>
          </>
        ) : null}
      </blockquote>
      {url && source ? (
        <p className="rq__src t-meta">
          <a href={url} className="link" target="_blank" rel="noopener noreferrer">
            The original at {source}
            <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden className="rq__arrow" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      ) : null}
    </figure>
  )
}
