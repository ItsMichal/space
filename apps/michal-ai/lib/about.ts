// Data helpers for /about and /resume: everything reads content/*.ts, and every link to a post goes through its stable `id`
// (frontmatter), so a slug rename never breaks a link. A missing id fails the build.
import { getAllPosts } from '@/lib/content'
import type { Post } from '@/lib/content/types'
import { postPath } from '@/lib/seo'
import { profile } from '@/content/profile'
import { hackathons, type Hackathon } from '@/content/hackathons'
import { press, type PressItem } from '@/content/press'

export function postById(id: string): Post {
  const post = getAllPosts().find((p) => (p.id ?? p.slug) === id)
  if (!post) throw new Error(`about: no post with id "${id}"`)
  return post
}
export const hrefById = (id: string) => postPath(postById(id))

/** Hackathon id to the id of the post on this site that covers the project. */
const HACKATHON_POST_ID: Record<string, string> = { 't9hacks-2023-project-mountaintop': 'project-mountaintop' }
export const hackathonPostHref = (h: Hackathon) => (HACKATHON_POST_ID[h.id] ? hrefById(HACKATHON_POST_ID[h.id]) : undefined)

/** Hackathons that have a submission, newest first. The registration-only entry is not shown. */
export const hackathonList = (): Hackathon[] => [...hackathons]

/** "2022-03" to "Mar 2022". */
export const monthYear = (iso: string) => new Date(`${iso}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
export const fullDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const byId = (id: string) => {
  const item = press.find((p) => p.id === id)
  if (!item) throw new Error(`about: no press item "${id}"`)
  return item as PressItem
}
/** Press shown on the page, most relevant first. The three iSAT newsletters share one row; the 2017 item gets a neutral label in the page. */
export const pressItems = () => ({
  atlas: byId('atlas-hackcu-2022'),
  aied: byId('isat-edm-aied-2022'),
  newsletters: ['isat-snapshot-summer-2022', 'isat-snapshot-winter-2023', 'isat-snapshot-summer-2025'].map(byId),
  shine: byId('shine-lab-staff-profile'),
  early: byId('denver-post-2017-kaiser'),
})
export const NEWSLETTER_LABEL: Record<string, string> = {
  'isat-snapshot-summer-2022': 'Summer 2022',
  'isat-snapshot-winter-2023': 'Winter 2023',
  'isat-snapshot-summer-2025': 'Summer 2025',
}

export const featuredProjects = () => profile.featuredProjectIds.map(postById)

/** Alt text for the owner's photograph: the name from the profile plus the neutral description. */
export const portraitAlt = `${profile.name}, ${profile.portrait.description}`

/** Short author line of a paper that acknowledges him: "Hirshfield et al." (first author's family name), or both names for two authors. */
export function mentionAuthors(m: { authors: readonly string[] }) {
  const family = (a: string) => a.trim().split(/\s+/).slice(-1)[0]
  if (m.authors.length === 1) return family(m.authors[0])
  if (m.authors.length === 2) return `${family(m.authors[0])} and ${family(m.authors[1])}`
  return `${family(m.authors[0])} et al.`
}
