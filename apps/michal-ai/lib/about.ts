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
  earlyRadio: byId('cpr-2017-kaiser'),
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

/**
 * Whole years of work across `profile.career`, overlapping roles counted once. Months are inclusive ("Jun to Aug 2018" is 3) and a
 * year-only end counts from that January, so the figure never runs ahead of the dates; a role with no end runs to `now`. Shown
 * as "6+ years" beside Experience.
 */
export function careerYears(career: readonly { start: string; end?: string }[] = profile.career, now = new Date()): number {
  const month = (iso: string) => {
    const [y, m = '01'] = iso.split('-')
    return Number(y) * 12 + Number(m) - 1
  }
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth()
  const spans = career.map((r) => [month(r.start), r.end ? month(r.end) : current] as const).sort((a, b) => a[0] - b[0])
  let total = 0
  let [from, to] = spans[0] ?? [0, -1]
  for (const [s, e] of spans.slice(1)) {
    if (s <= to + 1) to = Math.max(to, e)
    else {
      total += to - from + 1
      ;[from, to] = [s, e]
    }
  }
  total += to - from + 1
  return Math.floor(total / 12)
}
