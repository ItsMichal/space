// Single source of truth for who the site is about. The home page, metadata, JSON-LD and footer read from here.
// Facts come from public/BodzianowskiResume.pdf and existing site copy; update this file when LinkedIn data lands.

export type Role = {
  company: string
  role: string
  /** Display years, e.g. "2020 to now". Omit when unknown. */
  years?: string
}

export const profile = {
  /** Displayed name (Polish ł). */
  name: 'Michał Bodzianowski',
  firstName: 'Michał',
  lastName: 'Bodzianowski',
  /** ASCII spelling, only for search (JSON-LD alternateName). */
  asciiName: 'Michal Bodzianowski',
  nickname: 'halmic',
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
    { company: 'SpaceX', role: 'Software Engineer', years: '2024 to now' },
    { company: 'Institute of Cognitive Science, CU Boulder (SHINE Lab, iSAT)', role: 'Software Engineer', years: '2020 to 2024' },
    { company: 'AmedicaRx', role: 'Full stack developer (contract)', years: '2022 to 2023' },
    { company: 'Windward Studios', role: 'Software development intern', years: '2019 to 2020' },
    { company: 'Panther Industries', role: 'Augmented reality and marketing intern', years: '2018' },
  ] satisfies Role[],
} as const
