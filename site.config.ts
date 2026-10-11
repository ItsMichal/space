import { profile } from '@/content/profile'

export const siteConfig = {
  title: profile.name,
  description: profile.description,
  url: 'https://michal.ai',
  twitter: '@itsMichal',
  github: 'https://github.com/ItsMichal',
  /** halmic.com (streaming and design practice). Flip `live` to true once the site is up: it adds a footer link and a JSON-LD sameAs entry. */
  halmic: { url: 'https://halmic.com', live: false },
  linkedin: 'https://www.linkedin.com/in/mbodzianowski/',
}
