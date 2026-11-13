// One resume document as the sheet: /resume renders the site's own (lib/resume/site.ts defaultResume), the editor renders a tailored
// one with its own hooks for editing in place. Class names are components/about/resume.css; `.rs-paper` on the article sets it in
// print sizes (pt) scaled by --rs-k (type) and --rs-g (space), which is what both the PDF and the editor's page box show.
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { ResumeDoc, ResumeItem, ResumeSection } from '@/lib/resume/doc'
import { Inline } from '@/lib/resume/inline'

/** Where a piece of text lives in the document, for the editor's edit-in-place: section index, item index and field. */
export type Field = { s: number; i?: number; f: 'name' | 'contact' | 'title' | 'detail' | 'dates' | 'body' | 'meta' | 'bullet' | 'section'; n?: number }

export type SheetHooks = {
  /** Render one text field; the default prints its markup. */
  text?: (src: string, at: Field) => ReactNode
  /** Wrap an item (to add hover controls); the default is the item itself. */
  item?: (node: ReactNode, s: number, i: number) => ReactNode
}

const shown = <T extends { hidden?: boolean }>(xs: T[] | undefined) => (xs ?? []).map((x, n) => [x, n] as const).filter(([x]) => !x.hidden)

export function ResumeSheet({ doc, paper, hooks = {}, style, className = '' }: { doc: ResumeDoc; paper?: boolean; hooks?: SheetHooks; style?: CSSProperties; className?: string }) {
  const t = hooks.text ?? ((src: string) => <Inline src={src} />)
  const wrap = hooks.item ?? ((node: ReactNode) => node)
  const vars = { '--rs-k': doc.setting.type, '--rs-g': doc.setting.space, ...style } as CSSProperties
  return (
    <article className={`rs${paper ? ' rs-paper' : ''} ${className}`.trim()} style={vars} aria-label={`Resume of ${doc.name}`}>
      <header className="rs-head">
        <h1 className="rs-name">{t(doc.name, { s: -1, f: 'name' })}</h1>
        <p className="rs-contact">
          {doc.contact.map((c, n) =>
            c.href ? (
              <a key={n} href={c.href} rel="me">
                {t(c.text, { s: -1, f: 'contact', n })}
              </a>
            ) : (
              <span key={n}>{t(c.text, { s: -1, f: 'contact', n })}</span>
            ),
          )}
        </p>
      </header>
      {shown(doc.sections).map(([sec, s]) => (
        <section key={sec.id} className="rs-sec" aria-labelledby={`rs-${sec.id}`} data-section={s}>
          <h2 id={`rs-${sec.id}`} className="rs-h">
            {t(sec.title, { s, f: 'section' })}
          </h2>
          <Section sec={sec} s={s} t={t} wrap={wrap} />
        </section>
      ))}
    </article>
  )
}

type T = (src: string, at: Field) => ReactNode
type W = (node: ReactNode, s: number, i: number) => ReactNode

function Section({ sec, s, t, wrap }: { sec: ResumeSection; s: number; t: T; wrap: W }) {
  const items = shown(sec.items)
  if (sec.kind === 'skills')
    return (
      <dl className="rs-skills">
        {items.map(([it, i]) => (
          <div key={it.id} data-item={i}>
            {wrap(
              <>
                <dt>{t(it.title, { s, i, f: 'title' })}</dt>
                <dd>{t(it.body ?? '', { s, i, f: 'body' })}</dd>
              </>,
              s,
              i,
            )}
          </div>
        ))}
      </dl>
    )
  if (sec.kind === 'entries') return <>{items.map(([it, i]) => <Fragment key={it.id}>{wrap(<Entry it={it} s={s} i={i} t={t} />, s, i)}</Fragment>)}</>
  return (
    <ul className={`rs-list${sec.kind === 'list' ? ' rs-compact' : ''}`}>
      {items.map(([it, i]) => (
        <li key={it.id} className={`rs-item${sec.kind === 'cites' ? ' rs-cite' : ''}`} data-item={i}>
          {wrap(sec.kind === 'cites' ? <Cite it={it} s={s} i={i} t={t} /> : <Line it={it} s={s} i={i} t={t} sep={sec.sep ?? '. '} />, s, i)}
        </li>
      ))}
    </ul>
  )
}

/** Heading, detail and dates on one line, then body, bullets and the muted meta line. */
function Entry({ it, s, i, t }: { it: ResumeItem; s: number; i: number; t: T }) {
  const title = t(it.title, { s, i, f: 'title' })
  return (
    <div className="rs-item" data-item={i}>
      <div className="rs-line">
        <h3 className="rs-t">
          {it.href ? (
            <a className="rs-k" href={it.href}>
              {title}
            </a>
          ) : (
            title
          )}
          {it.detail ? <span className="rs-r">, {t(it.detail, { s, i, f: 'detail' })}</span> : null}
        </h3>
        {it.dates ? <p className="rs-d">{t(it.dates, { s, i, f: 'dates' })}</p> : null}
      </div>
      {it.body ? <p className="rs-p">{t(it.body, { s, i, f: 'body' })}</p> : null}
      {shown(it.bullets).length ? (
        <ul className="rs-b">
          {shown(it.bullets).map(([b, n]) => (
            <li key={n} data-bullet={n}>
              {t(b.text, { s, i, f: 'bullet', n })}
            </li>
          ))}
        </ul>
      ) : null}
      {it.meta ? <p className="rs-s">{t(it.meta, { s, i, f: 'meta' })}</p> : null}
    </div>
  )
}

/** Title and year on a line, the citation under it. */
function Cite({ it, s, i, t }: { it: ResumeItem; s: number; i: number; t: T }) {
  return (
    <>
      <div className="rs-line">
        <p className="rs-t">{t(it.title, { s, i, f: 'title' })}</p>
        {it.dates ? <p className="rs-d">{t(it.dates, { s, i, f: 'dates' })}</p> : null}
      </div>
      {it.body ? <p className="rs-p">{t(it.body, { s, i, f: 'body' })}</p> : null}
    </>
  )
}

/** One run-in line: "**title**, *detail*<sep>body", dates flush right when there are any. */
function Line({ it, s, i, t, sep }: { it: ResumeItem; s: number; i: number; t: T; sep: string }) {
  const title = t(it.title, { s, i, f: 'title' })
  const text = (
    <p className="rs-p">
      {it.href ? (
        <a className="rs-k" href={it.href}>
          {title}
        </a>
      ) : (
        <span className="rs-k">{title}</span>
      )}
      {it.detail ? <span className="rs-r">, {t(it.detail, { s, i, f: 'detail' })}</span> : null}
      {it.body ? (
        <>
          {sep}
          {t(it.body, { s, i, f: 'body' })}
        </>
      ) : null}
    </p>
  )
  return it.dates ? (
    <div className="rs-line">
      {text}
      <p className="rs-d">{t(it.dates, { s, i, f: 'dates' })}</p>
    </div>
  ) : (
    text
  )
}
