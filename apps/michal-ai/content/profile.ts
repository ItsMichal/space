// Single source of truth for who the site is about. The home page, metadata, JSON-LD and footer read from here.
// Facts come from public/BodzianowskiResume.pdf and existing site copy; update this file when LinkedIn data lands.

export type Role = {
  company: string
  role: string
  /** Year the role started, for the Experience timeline. Omit when unknown. */
  since?: string
  /** Display years, e.g. "2020 to now". Omit when unknown. */
  years?: string
  /** Short name for the timeline strip. */
  short?: string
}

export type Publication = {
  id: string
  title: string
  /** In the order printed on the paper. */
  authors: readonly string[]
  year: string
  /** ISO date of publication (from the DOI record). */
  published: string
  venue: string
  /** Short venue label for card meta lines. */
  venueShort: string
  pages?: string
  publisher: string
  doi: string
  /** His own words about his part, from his LinkedIn. */
  role: string
}

export const profile = {
  /** Displayed name (Polish ł). */
  name: 'Michał Bodzianowski',
  firstName: 'Michał',
  lastName: 'Bodzianowski',
  /** ASCII spelling, only for search (JSON-LD alternateName). */
  asciiName: 'Michal Bodzianowski',
  jobTitle: 'Software Engineer',
  /** Hero role line. Keep it short so it sits on one or two lines at 375px. */
  role: 'Creative developer. AI, web and systems.',
  /** Fixed stem of the hero's rotating line; the phrases come from each post's `hook` frontmatter (see components/site/HeroHook). */
  hookStem: "I've built",
  /** Site-wide meta description, 155 characters or fewer. */
  description:
    'Michał Bodzianowski is an award-winning creative developer and a software engineer at SpaceX, working on Starlink.com.',
  /** Page-title tagline: "<name> — <tagline>". */
  titleTagline: 'Creative developer',
  /** About section paragraphs, first person. */
  about: [
    "Hi, I'm Michał Bodzianowski, an award-winning creative developer with a passion for developing innovative and engaging user experiences. I specialize in full-stack web dev with React/TypeScript, as well as UI/UX design and AI/ML integrations.",
    "I'm a software engineer at SpaceX, growing the Starlink.com platform for millions and then billions worldwide. Before that I spent three and a half years at the Institute of Cognitive Science at the University of Colorado Boulder, working with the SHINE Laboratory and the AI Institute (iSAT).",
  ],
  worksFor: [
    { name: 'SpaceX', url: 'https://www.spacex.com' },
  ],
  alumniOf: ['University of Colorado Boulder'],
  knowsAbout: [
    'Full-stack development',
    'React',
    'TypeScript',
    'Next.js',
    'UI/UX design',
    'AI/ML integration',
    'DevOps (AWS, Kubernetes)',
    '.NET microservices',
    'Web platforms at scale',
  ],
  /** Compact home page Experience list, newest first. */
  experience: [
    { company: 'SpaceX', role: 'Software Engineer', since: '2024', years: '2024 to now' },
    { company: 'Institute of Cognitive Science, CU Boulder (SHINE Lab, iSAT)', role: 'Software Engineer', short: 'CU Boulder', since: '2020', years: '2020 to 2024' },
    { company: 'AmedicaRx', role: 'Full stack developer (contract)', since: '2022', years: '2022 to 2023' },
    { company: 'Windward Studios', role: 'Software development intern', since: '2019', years: '2019 to 2020' },
    { company: 'Panther Industries', role: 'Augmented reality and marketing intern', since: '2018', years: '2018' },
  ] satisfies Role[],
  /**
   * Publications, verified from the DOI registration record (Crossref, `api.crossref.org/works/<doi>`, the registry
   * entry ACM deposits) and the dblp author listing for the same title. The ACM page itself blocks automated access.
   */
  publications: [
    {
      id: 'chi-2025-jigsaw',
      title: 'Piecing Together Teamwork: A Responsible Approach to an LLM-based Educational Jigsaw Agent',
      authors: ['Emily Doherty', 'E. Margaret Perkoff', 'Sean von Bayern', 'Rui Zhang', 'Indrani Dey', 'Michal Bodzianowski', 'Sadhana Puntambekar', 'Leanne Hirshfield'],
      year: '2025',
      published: '2025-04-25',
      venue: 'Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems',
      venueShort: 'CHI 2025',
      pages: '1\u201317',
      publisher: 'ACM',
      doi: '10.1145/3706598.3713349',
      role: 'I was responsible for architecting and building out the web platform for teachers and students, allowing students to collaborate live with an LLM powered agent under educator supervision.',
    },
  ] satisfies Publication[],
} as const
