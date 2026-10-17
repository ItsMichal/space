import { getPublication, doiUrl, authorLine, venueLine, publicationJsonLd } from '@/lib/publications'
import { JsonLd } from '@/components/seo/JsonLd'
import { ArrowUpRight } from 'lucide-react'
import { profile } from '@/content/profile'
import './publications.css'

/** The papers a project is the home of: the formatted citation with its DOI, his own sentence about his part, and ScholarlyArticle JSON-LD. */
export function Publications({ ids }: { ids?: string[] }) {
  const pubs = (ids ?? []).map(getPublication).filter((p): p is NonNullable<typeof p> => Boolean(p))
  if (!pubs.length) return null
  return (
    <section className="pubs card surface reading__wide" aria-labelledby="pubs-h">
      <h2 id="pubs-h" className="pubs__h card__h t-heading">
        Publication
      </h2>
      {pubs.map((p) => (
        <article key={p.id} className="pubs__item">
          <JsonLd data={publicationJsonLd(p)} />
          <p className="pubs__cite">
            {authorLine(p)
              .split(', ')
              .map((a, i, all) => (
                <span key={`${a}-${i}`}>
                  {a === profile.asciiName ? <strong className="pubs__me">{a}</strong> : a}
                  {i < all.length - 1 ? ', ' : ''}
                </span>
              ))}
            . {p.year}. {p.title}. In <em>{venueLine(p)}</em>
            {p.publisher ? `. ${p.publisher}` : ''}.{' '}
            <a href={doiUrl(p)} className="link" target="_blank" rel="noopener noreferrer">
              {p.doi ? `doi:${p.doi}` : 'link'}
              <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="pubs__arrow" />
            </a>
          </p>
          {p.role ? <blockquote className="pubs__role">{p.role}</blockquote> : null}
        </article>
      ))}
    </section>
  )
}
