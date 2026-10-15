// The one sanctioned link between michal.ai and halmic.com. Everything either site prints about the other comes from
// here: the logo switcher (both directions), the paired-content map and the two marks. scripts/identity-lib.mjs reads
// this module to know exactly which strings are allowed on halmic.com, so adding a link anywhere else fails the check.
import { PAIRS } from './pairs.mjs'


export const MICHAL_ORIGIN = 'https://michal.ai'
export const HALMIC_ORIGIN = 'https://halmic.com'
/** What each site prints for the other in the switcher. The domain is the only label. */
export const MICHAL_DOMAIN = 'michal.ai'
export const HALMIC_DOMAIN = 'halmic.com'

export { PAIRS }

// The M! mark: copy of apps/michal-ai/public/logo.svg (also components/site/SiteMark.tsx), filled with currentColor.
export const M_MARK = {
  viewBox: '0 0 349.92 235.02',
  paths: [
    'm21.09,148.21h0c-14.64,0-23.76-11.86-20.38-26.5L22.68,26.5C26.06,11.86,40.67,0,55.3,0h0c14.64,0,23.76,11.86,20.38,26.5l-21.98,95.21c-3.38,14.64-17.98,26.5-32.62,26.5Z',
    'm113.86,140.54h0c-14.64,0-23.76-11.86-20.38-26.5h0c3.38-14.64,17.98-26.5,32.62-26.5h0c14.64,0,23.76,11.86,20.38,26.5h0c-3.38,14.64-17.98,26.5-32.62,26.5Z',
    'm183.06,235.02h0c-14.64,0-23.76-11.86-20.38-26.5L204.7,26.5C208.08,11.86,222.69,0,237.32,0h0c14.64,0,23.76,11.86,20.38,26.5l-42.02,182.02c-3.38,14.64-17.98,26.5-32.62,26.5Z',
    'm328.83,0h0c14.64,0,23.76,11.86,20.38,26.5l-20.21,87.54c-3.38,14.64-17.98,26.5-32.62,26.5h0c-14.64,0-23.76-11.86-20.38-26.5l20.21-87.54C299.59,11.86,314.2,0,328.83,0Z',
    'm274.07,235.02h0c-14.64,0-23.76-11.86-20.38-26.5h0c3.38-14.64,17.98-26.5,32.62-26.5h0c14.64,0,23.76,11.86,20.38,26.5h0c-3.38,14.64-17.98,26.5-32.62,26.5Z',
    'm183.06,235.02h-91.51c-14.64,0-23.76-11.86-20.38-26.5h0c3.38-14.64,17.98-26.5,32.62-26.5h91.51c14.64,0,23.76,11.86,20.38,26.5h0c-3.38,14.64-17.98,26.5-32.62,26.5Z',
    'm34.77,7.76h0c12.74-10.35,29.52-10.35,37.48,0l69.61,90.51c7.96,10.35,4.09,27.13-8.65,37.48h0c-12.74,10.35-29.52,10.35-37.48,0L26.12,45.24c-7.96-10.35-4.09-27.13,8.65-37.48Z',
    'm96.48,135.75h0c-7.96-10.35-4.09-27.13,8.65-37.48L216.54,7.76c12.74-10.35,29.52-10.35,37.48,0h0c7.96,10.35,4.09,27.13-8.65,37.48l-111.41,90.51c-12.74,10.35-29.52,10.35-37.48,0Z',
  ],
}

// The h mark: copy of apps/halmic/brand/svg/hmark-3-bare.svg (the site's header mark), filled with currentColor.
export const H_MARK = {
  viewBox: '0 0 202.41 235.02',
  paths: [
    'M77.82,26.5L35.8,208.52C32.42,223.16 41.55,235.02 56.18,235.02C70.82,235.02 85.42,223.16 88.8,208.52L130.82,26.5C134.2,11.86 125.08,0 110.44,0C95.81,0 81.2,11.86 77.82,26.5Z',
    'M21.09,161.81L169.09,161.81C183.72,161.81 198.32,149.95 201.7,135.31C205.08,120.67 195.96,108.81 181.32,108.81L33.32,108.81C18.69,108.81 4.08,120.67 0.7,135.31C-2.68,149.95 6.45,161.81 21.09,161.81Z',
    'M148.7,135.31L131.8,208.52C128.42,223.16 137.55,235.02 152.18,235.02C166.82,235.02 181.42,223.16 184.8,208.52L201.7,135.31C205.08,120.67 195.96,108.81 181.32,108.81C166.69,108.81 152.08,120.67 148.7,135.31Z',
  ],
}

/** Inline SVG markup for a mark (aria-hidden, currentColor fill). For the static halmic build; the Next app has components. */
export const markSvg = (mark, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} viewBox="${mark.viewBox}" aria-hidden="true" focusable="false">${mark.paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`

const key = (p) => String(p).replace(/\/+$/, '')

export const pairForPost = (postId) => PAIRS.find((p) => p.post === postId)
export const pairForHalmicPath = (path) => PAIRS.find((p) => key(p.halmic) === key(path))

/** Path of a michal.ai post: { slug, kind: 'article' | 'project', parent? }. Mirrors apps/michal-ai/lib/redirects.mjs. */
export function postPath(post) {
  if (post.parent) return `/projects/${post.parent}/${post.slug}`
  return `${post.kind === 'article' ? '/writing' : '/projects'}/${post.slug}`
}
/** Resolve a stable post id to its current path. posts = [{ id?, slug, kind, parent? }]; id falls back to the slug. */
export function michalPathFor(postId, posts) {
  const post = posts.find((p) => (p.id ?? p.slug) === postId)
  return post ? postPath(post) : undefined
}

/** The link michal.ai shows on a paired post: absolute Halmic URL, the domain, and Halmic's own title for the item. */
export function halmicLinkFor(postId) {
  const p = pairForPost(postId)
  return p ? { href: `${HALMIC_ORIGIN}${p.halmic}`, domain: HALMIC_DOMAIN, title: p.halmicTitle } : undefined
}

/** The link Halmic shows on a paired page. title is null when the michal.ai title must not be printed there. */
export function michalLinkFor(halmicPath, posts) {
  const p = pairForHalmicPath(halmicPath)
  if (!p) return undefined
  const path = michalPathFor(p.post, posts)
  if (!path) throw new Error(`crosslinks: no michal.ai post with id "${p.post}" (pair for ${p.halmic})`)
  return { href: `${MICHAL_ORIGIN}${path}`, domain: MICHAL_DOMAIN, title: p.michalTitle }
}

// Neutral handles for each side, so an app's own source never has to spell the other site's name (scripts/check-identity.mjs
// scans the halmic app for it, and warns on the portfolio's). Everything below is just the constants above under another name.
/** What Halmic prints for the portfolio. */
export const FOR_HALMIC = { origin: MICHAL_ORIGIN, domain: MICHAL_DOMAIN, mark: M_MARK, pairLink: michalLinkFor }
/** What the portfolio prints for Halmic. */
export const FOR_MICHAL = { origin: HALMIC_ORIGIN, domain: HALMIC_DOMAIN, mark: H_MARK, pairLink: halmicLinkFor }
