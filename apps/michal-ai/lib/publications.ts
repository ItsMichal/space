import { profile, type Publication } from '@/content/profile'
import { SITE_URL } from '@/lib/seo'

export const getPublication = (id: string): Publication | undefined => (profile.publications as readonly Publication[]).find((p) => p.id === id)

export const doiUrl = (p: Publication) => `https://doi.org/${p.doi}`

/** "Authors. Year. Title. In Venue, pages. Publisher. doi:..." (ACM reference style, as printed on the paper's page). */
export function citationParts(p: Publication) {
  return {
    authors: p.authors.join(', '),
    year: p.year,
    title: p.title,
    venue: p.venue,
    pages: p.pages,
    publisher: p.publisher,
  }
}

/** schema.org ScholarlyArticle, authored by the site's Person node (same @id as the home page and every post). */
export function publicationJsonLd(p: Publication) {
  const me = `${SITE_URL}/#person`
  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    '@id': `${doiUrl(p)}`,
    headline: p.title,
    name: p.title,
    datePublished: p.published,
    inLanguage: 'en',
    identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi },
    sameAs: doiUrl(p),
    url: doiUrl(p),
    publisher: { '@type': 'Organization', name: p.publisher },
    isPartOf: { '@type': 'PublicationIssue', name: p.venue },
    ...(p.pages ? { pagination: p.pages } : {}),
    author: p.authors.map((name) => (name === profile.asciiName ? { '@type': 'Person', '@id': me, name: profile.name } : { '@type': 'Person', name })),
  }
}
