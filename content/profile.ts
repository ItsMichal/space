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
  jobTitle: 'Creative developer',
  /** Hero role line. Keep it short so it sits on one or two lines at 375px. */
  role: 'Creative developer. AI, web and systems.',
  /** Hero intro paragraph. */
  intro: 'I take projects from 0 to 1.',
  /** Site-wide meta description, 155 characters or fewer. */
  description:
    'Michał Bodzianowski is a creative developer with experience in AI, web and systems, taking projects from 0 to 1.',
  /** Page-title tagline: "<name> — <tagline>". */
  titleTagline: 'Creative developer',
  /** About section paragraphs, first person. */
  about: [
    "I like the first version of things. The rough prototype. The odd idea. The thing that has to exist before anyone can argue about it.",
    "I run Halmic Ltd, a creative development studio. Before that I spent four years at the University of Colorado's SHINE Lab, working on human-AI interaction in education. I'm on Starlink's Consumer Platform team too.",
  ],
  worksFor: [
    { name: 'Halmic Ltd', url: 'https://halmic.co' },
    { name: 'Starlink', url: 'https://www.starlink.com' },
  ],
  alumniOf: ['University of Colorado Boulder'],
  knowsAbout: [
    'React',
    'TypeScript',
    'Next.js',
    'Full-stack web development',
    'AI and machine learning integration',
    'Platform engineering',
    'Distributed web systems',
    'UI and UX design',
    'AWS',
  ],
  /** Compact home page Experience list, newest first. */
  experience: [
    { company: 'Halmic Ltd', role: 'Runs the studio' },
    { company: 'Starlink', role: 'Full-stack engineer, Consumer Platform', years: '2024 to now' },
    { company: 'SHINE Lab, CU Boulder', role: 'Full-stack developer', years: '2020 to 2024' },
    { company: 'AmedicaRx', role: 'Full-stack developer', years: '2022 to 2023' },
    { company: 'Windward Studios', role: 'Software development intern', years: '2019 to 2020' },
    { company: 'Panther Labs', role: 'Augmented reality intern', years: '2018' },
  ] satisfies Role[],
} as const
