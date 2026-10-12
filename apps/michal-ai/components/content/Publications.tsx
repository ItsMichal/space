import { getPublication, doiUrl, citationParts, publicationJsonLd } from '@/lib/publications'
import { JsonLd } from '@/components/seo/JsonLd'
import { ArrowUpRight } from 'lucide-react'
import { profile } from '@/content/profile'
import './publications.css'

/** The papers a project is the home of: the formatted citation with its DOI, his own sentence about his part, and ScholarlyArticle JSON-LD. */
export function Publications({ ids }: { ids?: string[] }) {
  const pubs = (ids ?? []).map(getPublication).filter((p): p is NonNullable<typeof p> => Boolean(p))
  if (!pubs.length) return null
  return (
    <section className="pubs" aria-labelledby="pubs-h">
      <h2 id="pubs-h" className="pubs__h">
        Publication
      </h2>
      {pubs.map((p) => {
        const c = citationParts(p)
        return (
          <article key={p.id} className="pubs__item">
            <JsonLd data={publicationJsonLd(p)} />
            <p className="pubs__cite">
              {c.authors.split(', ').map((a, i, all) => (
                <span key={a}>
                  {a === profile.asciiName ? <strong className="pubs__me">{a}</strong> : a}
                  {i < all.length - 1 ? ', ' : ''}
                </span>
              ))}
              . {c.year}. {c.title}. In <em>{c.venue}</em>
              {c.pages ? `, ${c.pages}` : ''}. {c.publisher}.{' '}
              <a href={doiUrl(p)} className="link" target="_blank" rel="noopener noreferrer">
                doi:{p.doi}
                <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="pubs__arrow" />
              </a>
            </p>
            <blockquote className="pubs__role">{p.role}</blockquote>
          </article>
        )
      })}
    </section>
  )
}
