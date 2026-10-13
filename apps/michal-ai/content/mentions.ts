// Papers that name Michał Bodzianowski in the text (acknowledgments, system credits, contributor statements) without
// listing him as an author. Data only; nothing is wired into a page yet. Papers where he IS an author live in
// `profile.publications`; papers that only list him in a reference list (because he co-authored the cited work) are
// deliberately not here. Method, the full sweep, near-misses and paywalled candidates: docs/paper-mentions.md.
//
// Every quote was read in the full text named in `sources` (the NSF Public Access Repository accepted manuscript), and
// the same sentence was seen in Google Scholar's snippet of the published version. Research date: 2026-10-13.

export type MentionKind = 'acknowledgment' | 'system-credit' | 'contributor-statement' | 'other'

export type PaperMention = {
  id: string
  /** Authors in paper order, as printed by the DOI record. He is not among them. */
  authors: readonly string[]
  /** Year of the journal volume / proceedings. */
  year: string
  /** ISO date of first publication (online) from the DOI record. */
  published: string
  title: string
  venue: string
  /** Short venue label for card meta lines. */
  venueShort: string
  volume?: string
  issue?: string
  pages?: string
  publisher?: string
  doi?: string
  /** Canonical landing page (DOI link or publisher page). */
  url: string
  /** Free full text (accepted manuscript or open-access PDF). */
  openAccessUrl?: string
  mentionKind: MentionKind
  /** Where in the paper, e.g. the section name. */
  section?: string
  /** Exact sentence as printed (under 25 words). */
  quote: string
  /** Page of the file at `openAccessUrl` (PDF page number), not necessarily the journal's printed page. */
  page?: string
  /** Neutral third-person note of at most 15 words. */
  note: string
  /** Why this is the same person (same lab, same kind of work). */
  identityEvidence: string
  /** Stable id of a portfolio post that covers the same work, if one exists (frontmatter `id`). */
  relatedPostId?: string
  sources: string[]
}

export const paperMentions: readonly PaperMention[] = [
  {
    id: 'ijhci-2024-workload-adaptive-automation',
    authors: ['Leanne M. Hirshfield', 'Christopher Wickens', 'Emily Doherty', 'Cara Spencer', 'Tom Williams', 'Lucas Hayne'],
    year: '2024',
    published: '2023-10-23',
    title: 'Toward Workload-Based Adaptive Automation: The Utility of fNIRS for Measuring Load in Multiple Resources in the Brain',
    venue: 'International Journal of Human-Computer Interaction',
    venueShort: 'IJHCI 2024',
    volume: '40',
    issue: '22',
    pages: '7404-7430',
    publisher: 'Taylor & Francis',
    doi: '10.1080/10447318.2023.2266242',
    url: 'https://doi.org/10.1080/10447318.2023.2266242',
    openAccessUrl: 'https://par.nsf.gov/servlets/purl/10473499',
    mentionKind: 'acknowledgment',
    section: 'Acknowledgements',
    quote:
      'We’d also like to thank Michal Bodzianowski for his phenomenal support creating and maintaining the search and sort testbed used in our studies.',
    page: 'PDF page 40 of 63 (accepted manuscript)',
    note: 'Thanked for creating and maintaining the lab’s search-and-sort testbed.',
    identityEvidence:
      'Lab PI Leanne Hirshfield and co-author Emily Doherty are his SHINE Lab colleagues; his SHINE staff profile says he worked on lab testbeds.',
    sources: [
      'https://par.nsf.gov/servlets/purl/10473499',
      'https://par.nsf.gov/biblio/10473499',
      'https://api.crossref.org/works/10.1080/10447318.2023.2266242',
      'https://www.colorado.edu/lab/shine/michal-bodzianowski',
    ],
  },
]
