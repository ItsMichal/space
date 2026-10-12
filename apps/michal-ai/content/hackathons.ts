// Hackathon history. Data only: every field below was read from the cited source (see docs/hackathons-press.md for how
// each item was verified). Nothing here is wired into a page yet; a separate change renders it.
//
// Source of truth for the project list: the owner's Devpost profile (https://devpost.com/ItsMichal), which lists 4
// projects and 5 hackathons. HackMIT 2020 is not on Devpost; it comes from the repository README (see its `sources`).
// Awards are copied as printed by the source. Order: newest first.

export type HackathonLinks = {
  repo?: string
  demo?: string
  video?: string
  /** Design files (e.g. Figma). */
  design?: string
  /** Other project pages that are not a repo/demo/video. */
  other?: string[]
}

export type Hackathon = {
  id: string
  event: string
  eventUrl: string
  /** Host as printed by the event page or the news article; keep to what a source says. */
  organiser: string
  /** ISO month (YYYY-MM) of the event start, from the hackathon page. */
  date: string
  location?: string
  project: string
  /** Devpost project page. Absent for a hack that was never put on Devpost. */
  projectUrl?: string
  /** Prizes exactly as printed by the source. Empty when none is printed. */
  awards: string[]
  /** Only when a source states it (e.g. a Devpost team-role label). */
  role?: string
  /** Teammates as listed by the source. Data only; may not be displayed. */
  teammates?: string[]
  links: HackathonLinks
  /**
   * Stable slug of a portfolio post that covers the project, as it exists on main today. Slugs are being renamed in
   * parallel: re-map this by post id/title if the slug has changed when this data is rendered.
   */
  relatedPostSlug?: string
  /** Remote thumbnail (not downloaded). */
  thumbnailSourceUrl?: string
  /** Every URL the facts above were read from. */
  sources: string[]
}

export const hackathons: readonly Hackathon[] = [
  {
    id: 't9hacks-2023-project-mountaintop',
    event: 'T9Hacks 2023: To Infinity',
    eventUrl: 'https://t9hacks-2023.devpost.com/',
    organiser: 'T9Hacks (ATLAS Institute, CU Boulder)',
    date: '2023-02',
    location: 'Boulder, CO, USA',
    project: 'Space - Project Mountaintop',
    projectUrl: 'https://devpost.com/software/space-project-mountaintop',
    awards: [],
    teammates: [],
    links: {},
    relatedPostSlug: 'project-mountaintop',
    thumbnailSourceUrl: 'https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/386/860/datas/medium.png',
    sources: [
      'https://devpost.com/ItsMichal',
      'https://devpost.com/ItsMichal/challenges',
      'https://devpost.com/software/space-project-mountaintop',
      'https://t9hacks-2023.devpost.com/',
    ],
  },
  {
    id: 'hackcu-8-creatle',
    event: 'HackCU 8',
    eventUrl: 'https://hackcu8.devpost.com/',
    organiser: 'HackCU (CU Boulder)',
    date: '2022-03',
    location: 'Boulder, CO, USA',
    project: 'Creatle',
    projectUrl: 'https://devpost.com/software/creatle',
    awards: ['General - 2nd Place', 'Best Games, Music, and Entertainment Hack'],
    teammates: [],
    links: {
      demo: 'https://creatle.vercel.app/',
      repo: 'https://github.com/ItsMichal/Creatle',
    },
    relatedPostSlug: 'creatle',
    thumbnailSourceUrl: 'https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/001/863/139/datas/medium.png',
    sources: [
      'https://devpost.com/software/creatle',
      'https://hackcu8.devpost.com/',
      'https://www.colorado.edu/atlas/2022/04/04/atlas-students-take-home-hackcus-top-awards',
      'https://github.com/ItsMichal/Creatle',
    ],
  },
  {
    id: 't9hacks-2022-askawai',
    event: 'T9Hacks 2022: Go Beyond',
    eventUrl: 'https://t9hacks-2022.devpost.com/',
    organiser: 'T9Hacks (ATLAS Institute, CU Boulder)',
    date: '2022-02',
    location: 'Boulder, CO, USA',
    project: 'AskawAI',
    projectUrl: 'https://devpost.com/software/askawai',
    awards: [],
    role: 'OpenAI integration, back-end',
    teammates: ['Jamie JAJO7747'],
    links: {
      demo: 'https://www.askawai.com',
      repo: 'https://github.com/ItsMichal/askawAI',
    },
    relatedPostSlug: 'askawai',
    sources: [
      'https://devpost.com/software/askawai',
      'https://t9hacks-2022.devpost.com/',
      'https://github.com/ItsMichal/askawAI',
    ],
  },
  {
    id: 'hackcu-007-playsafe',
    event: 'HackCU 007',
    eventUrl: 'https://hackcu-007.devpost.com/',
    organiser: 'HackCU (CU Boulder)',
    date: '2021-03',
    location: 'Online',
    project: 'PlaySafe!',
    projectUrl: 'https://devpost.com/software/playsafe-rwsxqh',
    awards: [],
    role: 'Lead Designer',
    teammates: ['Jamie JAJO7747'],
    links: {
      design: 'https://www.figma.com/file/ysP5AWX37W9krzzStFFGQW/PlaySafe',
      demo: 'https://www.figma.com/proto/ysP5AWX37W9krzzStFFGQW/PlaySafe?node-id=1%3A14714&scaling=scale-down',
    },
    relatedPostSlug: 'playsafe',
    thumbnailSourceUrl: 'https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/001/426/215/datas/medium.png',
    sources: ['https://devpost.com/software/playsafe-rwsxqh', 'https://hackcu-007.devpost.com/'],
  },
  {
    id: 'hackmit-2020-sea-of-thoughts',
    event: 'HackMIT 2020',
    eventUrl: 'https://hackmit.org/',
    organiser: 'HackMIT',
    date: '2020-09',
    project: 'Sea of Thoughts',
    awards: [],
    teammates: ['Rebecca Coryell', 'Taryn Hovenkamp', 'Jamie Joung'],
    links: {
      repo: 'https://github.com/ItsMichal/sea-of-thoughts',
      // Listed in the README; returned HTTP 502 when checked on 2026-10-12.
      other: ['https://spectacle.hackmit.org/project/513'],
    },
    relatedPostSlug: 'sea-of-thoughts',
    sources: ['https://github.com/ItsMichal/sea-of-thoughts'],
  },
]

/**
 * Hackathons shown on the Devpost profile with no submission from him. Whether he took part or only registered is not
 * stated by Devpost: confirm with the owner before showing this anywhere.
 */
export type HackathonRegistration = {
  id: string
  event: string
  eventUrl: string
  /** ISO month of the event start. */
  date: string
  location?: string
  sources: string[]
}

export const hackathonRegistrationsOnly: readonly HackathonRegistration[] = [
  {
    id: 'lol-global-power-rankings-2023',
    event: 'Global Power Rankings Hackathon',
    eventUrl: 'https://lolglobalpowerrankings.devpost.com/',
    date: '2023-08',
    location: 'Online',
    sources: ['https://devpost.com/ItsMichal/challenges', 'https://lolglobalpowerrankings.devpost.com/'],
  },
]

export const devpostProfileUrl = 'https://devpost.com/ItsMichal'
