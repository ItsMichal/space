# Type scale: four sizes

The owner's rule: "keep font sizing consistent across the page, use no more than 3-4 font sizes generally". A normal screen of
content shows three or four sizes, never more. Fonts are unchanged (Michelangelus for display, Newsreader for text, IBM Plex Mono
for code); this document is about sizes only.

## The tokens

Defined once in `docs/design-system/tokens.json`, generated into `app/styles/tokens.css` (`npm run tokens`), applied by the role
classes in `app/styles/type.css`, and typed in `lib/design/type.ts` (`TypeLevel`, `TypeRole`, `typeClass()`); `lib/design/type.test.ts`
fails if the three disagree. Phones step the
same tokens down below 600px (`fontSizeMobile`), so there are no per-component clamps. The step is at 600px, not at the 768px layout
breakpoint: an unfolded phone or a small tablet (600 to 767px) keeps the phone layout but reads at the desktop sizes, so the 33rem
text column is about 70 characters at 18px, a book page, instead of about 75 at 17px.

| Token | Desktop | Phone | Line height | Face, weight | Used for |
| --- | --- | --- | --- | --- | --- |
| `title` | 44px | 34px | 1.1 | display, 400 | Section and page headings (Projects, Writing, About), the article title |
| `heading` | 24px | 21px | 1.2 | display, 400 | Card headings (Experience, More about me), titles on tiles, rows and page-end links, article h2, the lede |
| `body` | 18px | 17px | 1.55 | text, 400 (500 for item titles) | Paragraphs, descriptions, list rows, nav links, buttons, article prose, article h3 |
| `small` | 15px | 15px | 1.45 | text, 400 | Dates, years, roles, venue lines, captions, labels, footers, tertiary text; ink-muted |

Ratio: 15, 18, 24, 44 (1.2, 1.33, 1.83). Small is not stepped down on phones: below 15px Newsreader stops being comfortable.

Code and mono sit at `small` (`--type-code-size` is an alias of `--type-small-size`).

## The display exception

One size outside the four: `display-name`, the home page name (`clamp(96px, (100vw - 64px) / 6.2, 136px)` on desktop, 44 to 64px on phones, so
the name fills the column). Nothing else uses it. Page titles and article titles are `title`; no second exception was needed.

## Rules

1. Nothing sets a font size except these tokens. In CSS: `font-size: var(--type-body-size)` with `line-height: var(--type-body-line)`
   (or the `.t-*` classes in `app/styles/type.css`). In Tailwind: `text-title`, `text-heading`, `text-body`, `text-small`. No `text-[..px]`,
   no `text-sm`/`text-lg`, no `em` sizes, no `clamp()` outside the token definitions. `npm run check:type` enforces it.
2. Hierarchy inside a size comes from weight (400 or 500), colour (`--ink` or `--ink-muted`) and space, not from a new size.
3. Item titles sit one level below the head of their section (2026-10-28, the owner: "limit text sizes on the main page to just 3
   levels (plus header and one tiny one)"). Under a `title` section head (home: Projects, Writing, Publications) every item title is
   `heading`, so projects and posts read as one list. Under a `heading` sub-head (`.ix-sec`: Experience, the `/writing`
   and `/about` sections) an item title is `body` at 500 (`ui`). A tile that is itself the card (the `/projects` and `/writing` tiles)
   titles itself with `heading`. In code: `itemTitleRole(sectionHead)` in `lib/design/type.ts`.
4. Roles, years, venue lines, dates, captions: `small`, ink-muted.
5. Paragraphs in cards and article prose: `body`. A second paragraph in a lighter colour is still `body`.
6. Article headings: h1 `title`, h2 `heading`, h3 `body` at 500 in the display-free text face, h4 `small` at 500. The lede is `heading` in italic.
7. The reading column is `--text: 33rem`: about 70 characters of Newsreader at 18px. If `body` changes, re-measure (script below) and move the column.
8. Print stylesheets (resume, article print) keep their own `pt` sizes; `pt` is never flagged.
9. Out of scope and allowlisted in `scripts/type-allowlist.txt`: share cards (`lib/og.tsx`, rendered to PNG by next/og), dev-only labs
   (`*.dev.tsx` routes and the components they use), the Halmic app, and, until `michal-portrait-fix` merges, the reaction bar in `components/presence/presence.css`.

## Checking

- `npm run check:type` (part of `npm run check`): fails on any `font-size`, `font:` size, Tailwind arbitrary or named size, or inline `fontSize` outside the tokens and the allowlist.
- `node apps/michal-ai/scripts/measure-type.mjs` against a running site: the distinct computed font sizes of visible text per route at 1440 and 375.
- Screenshots before and after: `docs/type-shots/`.
