/*
 * The type system, as types. Sizes live in docs/design-system/tokens.json (generated into app/styles/tokens.css); the role
 * classes that apply them live in app/styles/type.css. This file names both so components can only ask for what exists,
 * and lib/design/type.test.ts fails if the three drift apart.
 *
 *   size levels   name (the home page header only), then three steps, then one small one:
 *                 title > heading > body, plus small for meta lines.
 *   roles         what a piece of text is; each role uses exactly one level, and `ui` is body at 500, not a new size.
 *
 * Hierarchy rule: an item's title sits one level below the heading of the section it is in. Under a `title` section
 * head (home: Selected work, Writing) item titles are `heading`; under a `heading` sub-head (Experience, Publications,
 * /writing, /about) they are `ui`.
 */

/** Every font size the site may use. Phones step each one down inside tokens.css; nothing else sets a size. */
export const TYPE_LEVELS = ['display-name', 'title', 'heading', 'body', 'small'] as const
export type TypeLevel = (typeof TYPE_LEVELS)[number]

/** Token styles: a level, or a weight/face variant of one that shares its size. */
export const TYPE_STYLES = {
  'display-name': 'display-name',
  title: 'title',
  heading: 'heading',
  body: 'body',
  'body-strong': 'body',
  small: 'small',
  code: 'small',
} as const satisfies Record<string, TypeLevel>
export type TypeStyle = keyof typeof TYPE_STYLES

/** What a piece of text is, and the class that sets it (app/styles/type.css). */
export const TYPE_ROLES = {
  /** Section and page headings, the article title, the hero hook. */
  title: { level: 'title', className: 't-title' },
  /** Sub-section heads, and item titles under a `title` section head. */
  heading: { level: 'heading', className: 't-heading' },
  /** Paragraphs, descriptions. Muted ink. */
  text: { level: 'body', className: 't-text' },
  /** Item titles under a `heading` sub-head, nav, buttons. Body size at 500. */
  ui: { level: 'body', className: 't-ui' },
  /** Dates, years, roles, venues, captions. */
  meta: { level: 'small', className: 't-meta' },
} as const satisfies Record<string, { level: TypeLevel; className: string }>
export type TypeRole = keyof typeof TYPE_ROLES

/** The role an item title takes under a section head of the given level. */
export function itemTitleRole(sectionHead: 'title' | 'heading'): TypeRole {
  return sectionHead === 'title' ? 'heading' : 'ui'
}

/** The class for a role: `<h2 className={typeClass('title')}>`. */
export function typeClass(role: TypeRole): string {
  return TYPE_ROLES[role].className
}
