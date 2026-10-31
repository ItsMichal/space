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
  /** The authors to name: for a large collaboration, the first authors plus him (in paper order). */
  authors: readonly string[]
  /** Total number of authors on the paper, when it is a large collaboration. */
  authorCount?: number
  /** Short author form for a citation line ("Mason, J. P., Werth, A., West, C. G., et al."), when `authors` is a subset. */
  shortAuthors?: string
  year: string
  /** ISO date of publication (from the DOI record). */
  published: string
  venue: string
  /** Short venue label for card meta lines. */
  venueShort: string
  pages?: string
  /** Journal references: volume, issue and article number (an article number replaces pages). */
  volume?: string
  issue?: string
  article?: string
  publisher?: string
  /** Absent for work with no DOI (a conference demo or interactive event). `url` is then the page to link to. */
  doi?: string
  url?: string
  /** His own words about his part, from his LinkedIn. Only set where he has said something. */
  role?: string
}

export type CareerEntry = {
  id: string
  company: string
  /** Short employer name for tight places (resume, card heads). */
  org: string
  role: string
  orgUrl?: string
  /** Display dates and ISO months (for <time>). `end` omitted means current. */
  dates: string
  start: string
  end?: string
  /** One or two sentences in his own words (LinkedIn), when he has them. */
  summary?: string
  bullets: readonly string[]
  /** Stable ids (frontmatter `id`) of the posts that cover this role; resolved to paths at build time. */
  postIds?: readonly string[]
  /** Short line of tools, only from what his LinkedIn, resume or project pages list. */
  stack?: string
}

export type Skill = { group: string; items: readonly string[] }

export type VolunteerEntry = { org: string; role: string; dates: string; start: string; end: string; note?: string }
export type Award = { id: string; title: string; context: string; year: string; postId?: string; hackathonId?: string; url?: string }

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
    'Michał Bodzianowski is a creative developer and software engineer: full-stack web, interface design and AI integrations, lately Starlink.com at SpaceX.',
  /** Page-title tagline: "<name> · <tagline>". */
  titleTagline: 'Creative developer',
  /** About section paragraphs, first person. */
  about: [
    "Hi, I'm Michał Bodzianowski. I build full-stack web apps in React and TypeScript, design their interfaces, and wire in AI and ML where it earns its place. My classroom dashboard for the iSAT AI Institute won Best Interactive Event at AIED 2022.",
    "I'm a software engineer at SpaceX, growing the Starlink.com platform for millions and then billions worldwide. Before that I spent three and a half years at the Institute of Cognitive Science at the University of Colorado Boulder, working with the SHINE Laboratory and the AI Institute (iSAT).",
  ],
  /** Current employer for JSON-LD `worksFor`. Empty: no current employer is stated (SpaceX ended in 2026); lib/seo omits the property then. */
  worksFor: [] as readonly { name: string; url: string }[],
  /** Past schools and employers for JSON-LD `alumniOf`. */
  alumniOf: [
    { type: 'CollegeOrUniversity', name: 'University of Colorado Boulder', url: 'https://www.colorado.edu' },
    { type: 'Organization', name: 'SpaceX', url: 'https://www.spacex.com' },
  ],
  /**
   * The owner's own photograph (public/media/about/portrait.webp, 900x1200, metadata stripped by scripts/make-about-portrait.mjs).
   * Used plainly: real background, no filter. `focus` is the object-position that frames the face when the card crops it.
   */
  portrait: {
    src: '/media/about/portrait.webp',
    /** Neutral description; the alt text is `${name}, ${description}` (see `portraitAlt` in lib/about.ts). */
    description: 'smiling, wearing round glasses, a white hoodie and a dark tweed blazer, outdoors',
    focus: '50% 28%',
    /** 4:5 JPEG for JSON-LD (search results). */
    jsonLd: '/media/about/portrait-4x5.jpg',
  },
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
    { company: 'SpaceX', role: 'Software Engineer', since: '2024', years: '2024 to 2026' },
    { company: 'Institute of Cognitive Science, CU Boulder (SHINE Lab, iSAT)', role: 'Software Engineer', short: 'CU Boulder', since: '2020', years: '2020 to 2024' },
    { company: 'AmedicaRx', role: 'Full stack developer (contract)', since: '2022', years: '2022 to 2023' },
    { company: 'Windward Studios', role: 'Software development intern', since: '2019', years: '2019 to 2020' },
    { company: 'Panther Industries', role: 'Augmented reality and marketing intern', since: '2018', years: '2018' },
  ] satisfies Role[],
  /** Status, in his words (dictated by the owner). Rendered at the top of /about; edit here only. */
  status: {
    location: 'California',
    sentences: [
      "I'm currently based in California and open to connections and meeting cool people.",
      'Reach out on LinkedIn with specifics.',
    ],
  },
  /** Public contact. No email is published, by the owner's choice. */
  contact: {
    x: 'https://x.com/ItsMichal',
  },
  /**
   * Full career, newest first. Source: the owner's own LinkedIn text (docs/content-review/linkedin-source.md), with the resume
   * for stack lines. Dates follow LinkedIn (the SpaceX end is year only, from the owner). Locations are left out on purpose.
   */
  career: [
    {
      id: 'spacex',
      company: 'SpaceX',
      org: 'SpaceX',
      role: 'Software Engineer',
      orgUrl: 'https://www.spacex.com',
      dates: 'Apr 2024 to 2026',
      start: '2024-04',
      end: '2026',
      summary: 'Growing the Starlink.com platform for millions and then billions worldwide, through technical excellence and collaboration with business stakeholders.',
      bullets: [
        'Responsible for unlocking the Starlink Mini retail launch',
        'Rebuilt our Order Flow from the ground up in React, improving conversion rate, aesthetic and UX',
        'Unblocked launch of service in international markets and lead localization efforts from the technical perspective',
        'Optimizing e-commerce growth and online presence; improving analytics and reporting for better insight',
        'Building the robust platform needed to support millions of customers and billions in sales',
        'Working from first principles on internal tooling that lets business stakeholders run experiments efficiently',
        'Mentoring interns and teammates',
      ],
      postIds: ['spacex-starlink-general-projects', 'spacex-starlink-order-flow', 'spacex-starlink-product-launch'],
      stack: 'Next.js and React, Angular, C# .NET microservices on Kubernetes and Argo, hosted on GCP',
    },
    {
      id: 'cu-boulder',
      company: 'Institute of Cognitive Science, University of Colorado Boulder (SHINE Lab, iSAT)',
      org: 'CU Boulder, Institute of Cognitive Science',
      role: 'Software Engineer',
      orgUrl: 'https://www.colorado.edu/research/ai-institute/',
      dates: 'Aug 2020 to Apr 2024',
      start: '2020-08',
      end: '2024-04',
      summary: "Improved the SHINE Laboratory's web-based experiments in HCI and cognitive science. Also a member of iSAT, the NSF AI Institute at CU Boulder, building AI/ML data visualizations for teachers.",
      bullets: [
        "Built out testbeds and websites in React, TypeScript and Next.js, including the lab's website, powered by Contentful",
        'Implemented real-time systems with WebSockets and Python/Flask backends, architecting MVC systems with maintainable code',
        'Created the dashboard display for AI/ML data output and won Best Interactive Event at the AI in Education Conference 2022',
        'Architected AWS deployments and pipelines and handled DevOps for the AI Institute (iSAT), working toward an efficient MLOps flow',
        'Architected and built the web platform for teachers and students behind the CHI 2025 jigsaw agent paper',
      ],
      postIds: ['jia-webapp', 'isat-dashboard'],
      stack: 'React, TypeScript, Next.js, Python/Flask, WebSockets, AWS, Contentful',
    },
    {
      id: 'amedicarx',
      company: 'AmedicaRx',
      org: 'AmedicaRx',
      role: 'Full Stack Developer (contract)',
      dates: 'Aug 2022 to Feb 2023',
      start: '2022-08',
      end: '2023-02',
      bullets: [
        'Worked directly with the CEO and founders to build a React and AWS web application',
        'Implemented GitLab CI/CD pipelines and a Jest test suite',
        'Built medication search and admin dashboard functionality to specification',
      ],
      stack: 'React, AWS (DynamoDB, S3, Route 53, Lambda), GitLab CI/CD, Jest',
    },
    {
      id: 'windward',
      company: 'Windward Studios',
      org: 'Windward Studios',
      role: 'Software Development Intern',
      dates: 'Sep 2019 to Feb 2020',
      start: '2019-09',
      end: '2020-02',
      bullets: ['Worked with web APIs and helped the company expand its offering by implementing new technologies and evolving existing systems'],
      stack: 'OpenAPI, Python, C++, .NET, Azure DevOps',
    },
    {
      id: 'panther',
      company: 'Panther Industries, Inc.',
      org: 'Panther Industries',
      role: 'Marketing and Augmented Reality Intern',
      dates: 'Jun to Aug 2018',
      start: '2018-06',
      end: '2018-08',
      bullets: ['Helped develop a Help and Support application that uses AR technologies'],
    },
  ] satisfies CareerEntry[],
  education: {
    school: 'University of Colorado Boulder',
    url: 'https://www.colorado.edu',
    degrees: ['B.S. Computer Science', 'B.S. Creative Technology and Design (ATLAS program)'],
    extras: ['Business minor', 'Certificate in Entrepreneurial Studies'],
    dates: '2019 to 2023',
    start: '2019',
    end: '2023',
    activities: ['CU Boulder Racing Team', 'CU Boulder Esports'],
  },
  volunteer: [
    {
      org: 'Blueprint Boulder',
      role: 'Vice President',
      dates: 'Apr 2022 to May 2023',
      start: '2022-04',
      end: '2023-05',
    },
    {
      org: 'Blueprint Boulder',
      role: 'Vice President of Technology',
      dates: 'Nov 2020 to Apr 2022',
      start: '2020-11',
      end: '2022-04',
      note: "Built the organization's website and technical foundation, consulted with non-profits, and mentored and led over 50 students across 10+ shipped projects for social good.",
    },
  ] satisfies VolunteerEntry[],
  /** Blueprint Boulder, from blueprintboulder.org (read Oct 2026). Roles and terms are the LinkedIn ones in `volunteer`; the site's own People page prints "Ex-Vice President, 2020 to Present". */
  blueprint: {
    name: 'Blueprint Boulder',
    url: 'https://blueprintboulder.org',
    /** Paraphrase of the org's own words, https://blueprintboulder.org/ ("We're Blueprint Boulder, and we've been creating tech for social good since 2020."). */
    description: 'A CU Boulder student organization building tech for social good since 2020.',
    descriptionSource: 'https://blueprintboulder.org/',
    peopleUrl: 'https://blueprintboulder.org/people',
    site: {
      label: 'Built the Blueprint Boulder website',
      repo: 'https://github.com/blueprintboulder/blueprintboulder-website',
      /** Repo README says "Built by ItsMichal"; repo created 2021-09-11; top contributor with 32 commits (GitHub API). */
      evidence: 'README credit and 32 commits, the most of any contributor',
    },
    /** Non-profit projects the site's /projects page lists inside his term (Nov 2020 to May 2023), as printed. */
    projectsSource: 'https://blueprintboulder.org/projects',
    projects: [
      { org: 'Safehouse Denver', url: 'https://safehouse-denver.org/', what: 'Database redesign plan and instructional videos', year: 'Spring 2021' },
      { org: 'Girls Inc Metro Denver', url: 'https://www.girlsincdenver.org/', what: 'Gamified learning platform', year: 'Spring 2021' },
      { org: 'Thinking Huts', url: 'https://www.thinkinghuts.org/', what: 'Web scraper to find Madagascan suppliers', year: 'Spring 2021' },
      { org: 'Impact on Education', url: 'https://www.impactoneducation.org/', what: 'Scholarship portal', year: '2021 to 2022' },
      { org: 'Anonymous Applications', url: 'https://github.com/blueprintboulder/f21s22-impact-on-education', what: 'Web-based identity redactor and form processor', year: '2021 to 2022' },
      { org: 'Colorado Immigrant Rights Coalition', url: 'https://coloradoimmigrant.org/', what: 'Hotline mobile app', year: '2021 to 2022' },
      { org: 'Foster Source', url: 'https://fostersource.org/', what: 'Respite matching website', year: '2021 to 2022' },
      { org: 'Earth Force', url: 'https://earthforce.org/', what: 'Sustainability challenge portal', year: '2022 to 2023' },
      { org: 'Lafayette Empowerment Center', url: 'https://www.lafayetteempowerment.org/', what: 'Database for grants, lesson plans and registration', year: '2022 to 2023' },
      { org: 'Bevara', url: 'https://bevara.co/', what: 'Website features for an outdoor stewardship program', year: '2022 to 2023' },
    ],
  },
  awards: [
    // The Congressional Record tribute leads (featured on the home page's About section too).
    {
      id: 'congressional-record-2014',
      title: 'Tribute in the Congressional Record',
      context: 'by Rep. Mike Coffman of Colorado, Extensions of Remarks, Vol. 160, p. E1105, for winning the Student Spaceflight Experiments Program',
      year: '2014',
      url: 'https://www.govinfo.gov/link/crec/160/e/1105',
    },
    { id: 'aied-2022', title: 'Best Interactive Event', context: 'AI in Education Conference (AIED), for the iSAT dashboard display', year: '2022', postId: 'isat-dashboard' },
    { id: 'hackcu-8', title: 'HackCU 8: 2nd place overall, and Best Games, Music, and Entertainment Hack', context: 'for Creatle, a solo project', year: '2022', hackathonId: 'hackcu-8-creatle' },
  ] satisfies Award[],
  /** Skills grouped as his LinkedIn, resume and project pages list them. No ratings. */
  skills: [
    { group: 'Web', items: ['React', 'TypeScript', 'Next.js', 'Angular', 'Tailwind CSS', 'Gatsby', 'UI/UX design'] },
    { group: 'Services and cloud', items: ['Python/Flask', 'C# .NET microservices', 'WebSockets', 'AWS (DynamoDB, S3, Route 53, Lambda)', 'Kubernetes and Argo', 'GCP', 'GitLab CI/CD', 'Jest', 'Azure DevOps'] },
    { group: 'AI and ML', items: ['LLM agent integration', 'AI/ML data visualization', 'MLOps', 'OpenAI APIs'] },
    { group: 'Games and embedded', items: ['Unity and C#', 'Arduino', 'C++'] },
  ] satisfies Skill[],
  /** Post ids shown in the About page's linked-projects grid and on the resume. */
  featuredProjectIds: [
    'spacex-starlink-general-projects',
    'jia-webapp',
    'isat-dashboard',
    'realtime-ai-f1-comentator',
    'project-mountaintop',
    'office-wizards-barcode-game',
  ],
  /** Projects on his published resume that have no post on this site. Source: public/BodzianowskiResume.pdf, and content/hackathons.ts for Creatle. */
  resumeExtraProjects: [
    { name: 'Creatle', role: 'Solo developer', dates: 'Mar 2022', line: 'A web-based game engine concept, a build-your-own Wordle spinoff, in TypeScript, Prisma, Next.js and Tailwind CSS. 2nd place overall and Best Games, Music, and Entertainment Hack at HackCU 8.' },
    { name: 'GroceryBot', role: 'Lead developer', dates: 'Fall 2021', line: 'An autonomous grocery-shopping robot in the Webots simulator, using inverse kinematics, path planning and computer vision, with an online shopping interface. Later used as a template for final projects in the course.' },
  ],
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
    {
      id: 'apj-2023-coronal-heating',
      title: 'Coronal Heating as Determined by the Solar Flare Frequency Distribution Obtained by Aggregating Case Studies',
      authors: ['James Paul Mason', 'Alexandra Werth', 'Colin G. West', 'Allison Youngblood', 'Michal Bodzianowski'],
      authorCount: 1002,
      shortAuthors: 'Mason, J. P., Werth, A., West, C. G., et al.',
      year: '2023',
      published: '2023-05-01',
      venue: 'The Astrophysical Journal',
      venueShort: 'ApJ 2023',
      volume: '948',
      issue: '2',
      article: '71',
      doi: '10.3847/1538-4357/accc89',
    },
    {
      id: 'lak-2023-isat-pipeline',
      title: 'The iSAT Collaboration Analytics Pipeline',
      authors: ['John Weatherley', 'Rachel Dickler', 'Peter W. Foltz', 'Aravind B. Srinivas', 'Samuel Pugh', 'Nikhil Krishnaswamy', 'Jacob Whitehill', 'Michal Bodzianowski', 'Maggie Perkoff', 'Rosy Southwell', 'Jeff Bush', 'Michael Chang', 'Leanne Hirshfield', 'Daeja Showers', 'Ananya Ganesh', 'Zeqian Li', 'Elita Danilyuk', 'Xinlu He', 'Ibrahim Khalil Khebour', 'Indrani Dey', 'Sidney K. D\u2019Mello'],
      year: '2023',
      published: '2023-03',
      venue: 'Companion Proceedings of the 13th International Conference on Learning Analytics & Knowledge (LAK23), Demos',
      venueShort: 'LAK 2023',
      pages: '176',
      publisher: 'Society for Learning Analytics Research',
      url: 'https://www.solaresearch.org/wp-content/uploads/2023/03/LAK23_CompanionProceedings.pdf',
    },
    {
      id: 'aied-2022-isat-display',
      title: 'iSAT Speech-based AI Display for Small Group Collaboration in Classrooms',
      authors: ['Rachel Dickler', 'Peter Foltz', 'Nikhil Krishnaswamy', 'Jacob Whitehill', 'John Weatherly', 'Michal Bodzianowski', 'Margaret Perkoff', 'Rosy Southwell', 'Sam Pugh', 'Jeff Bush', 'Michael Chang', 'Leanne Hirshfield', 'Daeja Showers', 'Ananya Ganesh', 'Zeqian Li', 'Elita Danilyuk', 'Xinlu He', 'Ibrahim Khalil Khebour', 'Indrani Dey', 'Sadhana Puntambekar', 'Sidney K. D\u2019Mello'],
      year: '2022',
      published: '2022-07',
      venue: 'Interactive event at the International Conference on Artificial Intelligence in Education (AIED)',
      venueShort: 'AIED 2022',
      publisher: 'International AIEd Society',
      url: 'https://www.colorado.edu/research/ai-institute/2022/07/14/july-23-31-2022-isat-presents-international-conference-educational-data-mining-edm-and',
    },
  ] satisfies Publication[],
} as const
