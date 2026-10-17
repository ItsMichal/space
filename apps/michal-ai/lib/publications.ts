import { profile, type Publication } from '@/content/profile'
import { SITE_URL } from '@/lib/seo'

export const getPublication = (id: string): Publication | undefined => (profile.publications as readonly Publication[]).find((p) => p.id === id)

export const doiUrl = (p: Publication) => (p.doi ? `https://doi.org/${p.doi}` : (p.url as string))

const isJournal = (p: Publication) => Boolean(p.volume)

/** The venue part of a reference: "In <Proceedings>, 1-17. ACM." or "<Journal>, 948(2), 71." */
export function venueLine(p: Publication) {
  if (isJournal(p)) return `${p.venue}, ${p.volume}${p.issue ? `(${p.issue})` : ''}${p.article ? `, ${p.article}` : p.pages ? `, ${p.pages}` : ''}`
  return `${p.venue}${p.pages ? `, ${p.pages}` : ''}`
}

/** The author part: the full list for an ordinary paper, the short "et al." form for a large collaboration. */
export const authorLine = (p: Publication) => p.shortAuthors ?? p.authors.join(', ')

/** schema.org ScholarlyArticle, authored by the site's Person node (same @id as the home page and every post). A large collaboration lists its first authors and him, never all of them. */
export function publicationJsonLd(p: Publication) {
  const me = `${SITE_URL}/#person`
  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    '@id': doiUrl(p),
    headline: p.title,
    name: p.title,
    datePublished: p.published,
    inLanguage: 'en',
    ...(p.doi ? { identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi }, sameAs: doiUrl(p) } : {}),
    url: doiUrl(p),
    ...(p.publisher ? { publisher: { '@type': 'Organization', name: p.publisher } } : {}),
    isPartOf: isJournal(p)
      ? {
          '@type': 'PublicationIssue',
          ...(p.issue ? { issueNumber: p.issue } : {}),
          isPartOf: { '@type': 'PublicationVolume', volumeNumber: p.volume, isPartOf: { '@type': 'Periodical', name: p.venue } },
        }
      : { '@type': 'PublicationIssue', name: p.venue },
    ...(p.pages ? { pagination: p.pages } : p.article ? { pagination: p.article } : {}),
    author: p.authors.map((name) => (name === profile.asciiName ? { '@type': 'Person', '@id': me, name: profile.name } : { '@type': 'Person', name })),
  }
}
