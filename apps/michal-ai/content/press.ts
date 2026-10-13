// Press and institutional mentions of Michał Bodzianowski. Data only: headlines are copied as published, `mention` is a
// neutral third-person note. Nothing here is wired into a page yet. See docs/hackathons-press.md for how each item was
// verified as the same person, link health (checked 2026-10-12) and the items that still need the owner.

export type PressKind = 'news' | 'award' | 'expo' | 'lab' | 'other'

/** How he appears in the item. */
export type PressPresence = 'quoted' | 'pictured' | 'listed'

export type PressItem = {
  id: string
  outlet: string
  /** Headline or page title exactly as published. */
  title: string
  url: string
  /** ISO date (YYYY-MM-DD). null for an undated page; then `dateNote` says what is known. */
  date: string | null
  dateNote?: string
  author?: string
  /** Neutral third-person note of at most 15 words. */
  mention: string
  presence: readonly PressPresence[]
  kind: PressKind
  /** True when the item is published by a CU Boulder site (colorado.edu). */
  isCuBoulder: boolean
  /** Why this is the same person (project names, affiliation, photo, his own README). */
  identityEvidence: string
  /** Existing archive.org snapshot; never created by us. */
  archiveUrl?: string
  /** Slug of a portfolio post on main today (slugs are being renamed; re-map by title if needed). */
  relatedPostSlug?: string
  sources: string[]
}

export const press: readonly PressItem[] = [
  {
    id: 'atlas-hackcu-2022',
    outlet: 'ATLAS Institute, CU Boulder',
    title: "ATLAS students take home HackCU's top awards",
    url: 'https://www.colorado.edu/atlas/2022/04/04/atlas-students-take-home-hackcus-top-awards',
    date: '2022-04-04',
    mention: 'Second prize overall and Best Game and Entertainment prize at HackCU 2022 for Creatle.',
    presence: ['quoted', 'pictured'],
    kind: 'award',
    isCuBoulder: true,
    identityEvidence:
      'Names Creatle, which his Devpost profile and GitHub repo list; credits a CS and CTD major; photo alt text names him.',
    archiveUrl:
      'https://web.archive.org/web/20260509140326/https://www.colorado.edu/atlas/2022/04/04/atlas-students-take-home-hackcus-top-awards',
    sources: [
      'https://www.colorado.edu/atlas/2022/04/04/atlas-students-take-home-hackcus-top-awards',
      'https://devpost.com/software/creatle',
    ],
  },
  {
    id: 'isat-edm-aied-2022',
    outlet: 'NSF AI Institute for Student-AI Teaming (iSAT), CU Boulder',
    title:
      'July 23 - 31, 2022: iSAT Presents at the International Conference on Educational Data Mining (EDM) and the International Conference on Artificial Intelligence in Education (AIED)',
    url: 'https://www.colorado.edu/research/ai-institute/2022/07/14/july-23-31-2022-isat-presents-international-conference-educational-data-mining-edm-and',
    date: '2022-07-14',
    dateNote: 'Date taken from the URL path.',
    mention: 'Listed as a co-author of the AIED interactive event on a speech-based AI display.',
    presence: ['listed'],
    kind: 'lab',
    isCuBoulder: true,
    identityEvidence: 'Same institute as his SHINE Laboratory staff profile, which names iSAT; iSAT work is in apps/michal-ai/content/profile.ts.',
    archiveUrl:
      'https://web.archive.org/web/20240628094037/https://www.colorado.edu/research/ai-institute/2022/07/14/july-23-31-2022-isat-presents-international-conference-educational-data-mining-edm-and',
    relatedPostSlug: 'isat-dashboard',
    sources: [
      'https://www.colorado.edu/research/ai-institute/2022/07/14/july-23-31-2022-isat-presents-international-conference-educational-data-mining-edm-and',
      'https://www.colorado.edu/lab/shine/michal-bodzianowski',
    ],
  },
  {
    id: 'shine-lab-staff-profile',
    outlet: 'SHINE Laboratory, CU Boulder',
    title: 'Michal Bodzianowski',
    url: 'https://www.colorado.edu/lab/shine/michal-bodzianowski',
    date: null,
    dateNote: 'Undated staff profile page.',
    mention: 'Staff profile; states B.S. Computer Science and B.S. Creative Technology and Design.',
    presence: ['listed'],
    kind: 'lab',
    isCuBoulder: true,
    identityEvidence: 'First-party lab page under his name; lists SpaceX as his current job.',
    sources: ['https://www.colorado.edu/lab/shine/michal-bodzianowski'],
  },
  {
    id: 'isat-snapshot-summer-2022',
    outlet: 'NSF AI Institute for Student-AI Teaming (iSAT), CU Boulder',
    title: 'SAT Snapshot, NSF AI Institute for Student-AI Teaming, Summer 2022',
    url: 'https://www.colorado.edu/research/ai-institute/media/691',
    date: null,
    dateNote: 'Newsletter issue "Summer 2022" (PDF); no day printed.',
    mention: 'Listed among authors of the iSAT speech-based AI display interactive event at AIED 2022.',
    presence: ['listed'],
    kind: 'lab',
    isCuBoulder: true,
    identityEvidence: 'Same author-list entry as the iSAT EDM and AIED 2022 page above.',
    archiveUrl: 'https://web.archive.org/web/20250803214505/https://www.colorado.edu/research/ai-institute/media/691',
    sources: ['https://www.colorado.edu/research/ai-institute/media/691'],
  },
  {
    id: 'isat-snapshot-winter-2023',
    outlet: 'NSF AI Institute for Student-AI Teaming (iSAT), CU Boulder',
    title: 'SAT Snapshot, NSF AI Institute for Student-AI Teaming, Winter 2023',
    url: 'https://www.colorado.edu/research/ai-institute/sites/default/files/attached-files/isat_newsletter_winter2023updated.pdf',
    date: null,
    dateNote: 'Newsletter issue "Winter 2023" (PDF); the file metadata says modified 2023-03-06.',
    mention: 'Listed among authors of the iSAT Collaboration Analytics Pipeline workshop paper.',
    presence: ['listed'],
    kind: 'lab',
    isCuBoulder: true,
    identityEvidence: 'Same iSAT team and author-list spelling as the other iSAT items.',
    archiveUrl:
      'https://web.archive.org/web/20240917182044/https://www.colorado.edu/research/ai-institute/sites/default/files/attached-files/isat_newsletter_winter2023updated.pdf',
    sources: ['https://www.colorado.edu/research/ai-institute/sites/default/files/attached-files/isat_newsletter_winter2023updated.pdf'],
  },
  {
    id: 'isat-snapshot-summer-2025',
    outlet: 'NSF AI Institute for Student-AI Teaming (iSAT), CU Boulder',
    title: 'SAT Snapshot, NSF AI Institute for Student-AI Teaming, Summer 2025',
    url: 'https://www.colorado.edu/research/ai-institute/media/792',
    date: null,
    dateNote: 'Newsletter issue "Summer 2025" (PDF); no day printed.',
    mention: 'Listed as co-author of the CHI 2025 jigsaw agent paper and a submitted JIA paper.',
    presence: ['listed'],
    kind: 'lab',
    isCuBoulder: true,
    identityEvidence: 'CHI 2025 paper is already on his profile (DOI 10.1145/3706598.3713349).',
    archiveUrl: 'https://web.archive.org/web/20260112231431/https://www.colorado.edu/research/ai-institute/media/792',
    relatedPostSlug: 'jia-webapp',
    sources: ['https://www.colorado.edu/research/ai-institute/media/792'],
  },
  {
    id: 'shine-lab-site-credit',
    outlet: 'SHINE Lab website',
    title: 'Posts - SHINE Lab',
    url: 'https://www.shinelaboratory.com/posts',
    date: null,
    dateNote: 'Undated; footer says 2024.',
    mention: 'Footer credits him as developer of the lab website.',
    presence: ['listed'],
    kind: 'lab',
    isCuBoulder: false,
    identityEvidence: 'Footer names him; lab domain is the one linked from his GitHub TrustTeaming repo.',
    archiveUrl: 'https://web.archive.org/web/20250614144904/https://www.shinelaboratory.com/posts',
    sources: ['https://www.shinelaboratory.com/posts'],
  },
  {
    id: 'denver-post-2017-kaiser',
    outlet: 'The Denver Post',
    title: 'Highlands Ranch students use virtual dialogue with WWI kaiser to spark interest in history',
    url: 'https://www.denverpost.com/2017/02/21/highlands-ranch-history-class-artificial-intelligence/',
    date: '2017-02-21',
    author: 'Monte Whaley',
    mention: 'Named as co-leader of a high school WWI talking-heads AI project; photographed.',
    presence: ['pictured', 'listed'],
    kind: 'news',
    isCuBoulder: false,
    identityEvidence:
      'His own repository README (ItsMichal/pilsudski) links this article and says it was made in his sophomore year of high school; the article names him as a sophomore at STEM School Academy.',
    archiveUrl:
      'https://web.archive.org/web/20260503094433/https://www.denverpost.com/2017/02/21/highlands-ranch-history-class-artificial-intelligence/',
    sources: [
      'https://www.denverpost.com/2017/02/21/highlands-ranch-history-class-artificial-intelligence/',
      'https://github.com/ItsMichal/pilsudski',
    ],
  },
]
