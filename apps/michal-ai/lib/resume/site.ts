// The site's own resume as a document (lib/resume/doc.ts), built from content/profile.ts and the featured posts. /resume prints
// it, and the editor starts a tailored copy from it.
import { profile, type Publication } from '@/content/profile'
import { doiUrl, venueLine } from '@/lib/publications'
import { featuredProjects } from '@/lib/about'
import { postPath, SITE_URL } from '@/lib/seo'
import { siteConfig } from '@/site.config'
import { SETTING, type ResumeDoc, type ResumeItem } from './doc'

const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
const host = (u: string) => new URL(u).hostname.replace(/^www\./, '')
/** Markup-escape for text that comes from data: the inline markup's own characters. */
const esc = (s: string) => s.replace(/([*[\]\\])/g, '\\$1')

/**
 * Author list: everyone on a short paper; for a long one the first three, then him (bold) if he comes later, then "et al". The full
 * lists stay on /about and in the JSON-LD.
 */
export function authorsMarkup(p: Publication): string {
  const me = profile.asciiName
  const total = p.authorCount ?? p.authors.length
  const name = (a: string) => (a === me ? `**${profile.name}**` : esc(a))
  const shown = total <= 5 ? [...p.authors] : p.authors.slice(0, 3)
  const parts = shown.map(name)
  let named = parts.length
  if (!shown.includes(me) && p.authors.includes(me)) {
    parts.push('...', name(me))
    named++
  }
  if (total > named) parts.push('et al')
  return parts.join(', ')
}

/** Blueprint's two terms as one entry: roles newest first, dates from the first start to the last end. */
function leadership(): ResumeItem {
  const vp = [...profile.volunteer].sort((a, b) => a.start.localeCompare(b.start))
  const b = profile.blueprint
  return {
    id: 'blueprint',
    title: b.name,
    detail: vp.map((v) => v.role).reverse().join('; '),
    dates: `${vp[0].dates.split(' to ')[0]} to ${vp[vp.length - 1].dates.split(' to ')[1]}`,
    body: `Built the organization's website (${strip(b.url)}) and helped oversee student teams building software for non-profits (${b.projects.length} projects from Spring 2021 to April 2023).`,
  }
}

/** The site's own resume, from content/profile.ts and the featured posts. Order: Experience, Education, Leadership, Publications,
 *  Selected projects, Awards and press, Skills. Privacy bar: state only, no phone, street address, email or birthday. */
export function defaultResume(): ResumeDoc {
  const ed = profile.education
  const projects = featuredProjects().filter((p) => p.id !== 'spacex-starlink-general-projects')
  return {
    version: 1,
    name: profile.name,
    contact: [
      { text: profile.jobTitle },
      { text: profile.status.location },
      { text: strip(siteConfig.linkedin), href: siteConfig.linkedin },
      { text: strip(siteConfig.github), href: siteConfig.github },
      { text: strip(SITE_URL), href: SITE_URL },
    ],
    sections: [
      {
        id: 'experience',
        title: 'Experience',
        kind: 'entries',
        items: profile.career.map((r) => ({
          id: r.id,
          title: r.org,
          detail: r.role,
          dates: r.dates,
          bullets: r.bullets.map((text) => ({ text: esc(text) })),
          ...(r.stack ? { meta: `**Stack:** ${esc(r.stack)}` } : {}),
        })),
      },
      {
        id: 'education',
        title: 'Education',
        kind: 'entries',
        items: [{ id: 'cu', title: ed.school, dates: ed.dates, body: ed.degrees.join('; '), meta: ed.extras.join('; ') }],
      },
      { id: 'leadership', title: 'Leadership', kind: 'entries', items: [leadership()] },
      {
        id: 'publications',
        title: 'Publications',
        kind: 'cites',
        items: profile.publications.map((p) => ({
          id: p.id,
          title: p.title,
          dates: p.year,
          body: `${authorsMarkup(p)}. *${esc(venueLine(p))}*. [${p.doi ? `doi:${p.doi}` : host(doiUrl(p))}](${doiUrl(p)})`,
        })),
      },
      {
        id: 'projects',
        title: 'Selected projects',
        kind: 'list',
        sep: '. ',
        items: [
          ...projects.map((p) => ({ id: p.id ?? p.slug, title: p.title, href: `${SITE_URL}${postPath(p)}`, ...(p.role ? { detail: p.role } : {}), body: esc(p.description) })),
          ...profile.resumeExtraProjects.map((p) => ({ id: p.name.toLowerCase(), title: p.name, detail: `${p.role}, ${p.dates}`, body: esc(p.line) })),
        ],
      },
      {
        id: 'awards',
        title: 'Awards and press',
        kind: 'list',
        sep: ', ',
        items: profile.awards.map((a) => ({ id: a.id, title: a.title, body: esc(a.context), dates: a.year })),
      },
      { id: 'skills', title: 'Skills', kind: 'skills', items: profile.skills.map((s) => ({ id: s.group.toLowerCase().replace(/\W+/g, '-'), title: s.group, body: s.items.join(', ') })) },
    ],
    setting: { ...SETTING },
  }
}

