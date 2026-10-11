# Paper: the design system for michal.ai

Printed matter in a northern landscape: a birch-paper page, basalt ink, moss for the one living accent, out-of-focus flowers behind the text, and liquid glass for the few things that float. This file is the law; `benchmark.md` is the professional bar every screen is held to and `docs/motion/craft.md` is the standard every motion must meet. Tokens: `tokens.json` (generates `app/styles/tokens.css` via `npm run tokens`).

## Principles

- **Paper and nature.** A well-made printed object left outside on a clear day: warm off-white stock, dark ink, a little moss. No neon, no gradients, no glow.
- **Light and comforting first.** The landing page and index pages are always light. Dark exists only on reading pages.
- **Restraint, at scale.** Very large type, generous space, one idea per screen, imagery allowed to be big. Remove anything that does not earn its place.
- **Flat page, floating glass.** Content sits directly on paper: no cards, boxes or shadows. Glass is only for chrome that hovers: the nav, buttons, the page control, menus, previews.
- **No presence UI.** No visitor counts, ghosts, globes, "N here now" or chat. (The old globe, presence chip and lidar field are gone.)
- **Apple-clean and professional.** Rigid alignment, few sizes, tight tracking. See `benchmark.md` for the checklist.
- **Best work first.** Order by significance, not date. Progress logs live under their project.

## Content

First person, plain, a little playful, short declarative lines. Sentence case everywhere: **no uppercase text, no letter-spaced small caps.** The name is **Michał Bodzianowski** (with ł); URLs, handles and file names stay ASCII; the nickname **halmic** is lowercase. No emoji in titles or UI. Spec lines (year, stack, role) and dates are small serif in `ink-muted`, joined with ` · `. Copy lives in `content/profile.ts` (about, experience, hero stem) and each post's frontmatter (`hook` feeds the work line).

## Color

- **Birch** (light) is the default and the only theme on `/`, `/projects`, `/writing`. **Basalt** (dark) applies only to reading pages (project pages, progress-log entries, posts), following `prefers-color-scheme`. Reading layouts set `<html data-reading>` (`<ReadingTheme/>`, before first paint); dark tokens live under `:root[data-reading]`. `viewport.themeColor` is light except on reading pages.
- Text is `ink` or `ink-muted`, nothing else. `ink-faint`, `dot`, `hairline` are for marks, never text. `accent` (moss) is link hover, progress and one highlighted word per screen. `focus` is a solid 2px glacier-water ring, offset 2px, on every interactive element.

## Type

- **Display: Michelangelus** (`font-display`): name, section heads, role line, work line, project titles. Regular + Italic, Latin and Latin Extended (Polish ł), self-hosted (`app/fonts/*.woff2`), tracking -2%, line-height 0.88 to 1.1, with a size-adjusted fallback so the swap shifts nothing. Details: `type-michelangelus.md`. **To swap it, edit only `app/fonts/display.ts`** (the file shows the Instrument Serif replacement); `--font-display-face` maps to `font-display` everywhere.
- **Schibsted Grotesk** (`sans`): UI, nav, buttons, reading-page headings. **Newsreader** (`serif`): prose, meta (italic), spec lines, captions; use its optical-size axis; body 19 to 20px. **IBM Plex Mono** (`mono`): code only, nowhere else.
- The hero is the name on two lines, flush left, the role in italic, then the rotating work line. At most 3 sizes and 2 families on the first screen. Never set prose in the sans.

## Layout and mobile

12-column grid, content 1120px, prose 66ch, gutters `space-4` (phone) and `space-8` (from 768px), section rhythm `space-16`, hero to first section `space-24` (spacing ladder 8, 16, 24, 32, 48, 64, 96, 160). Work is an editorial index, not cards: a featured project with a large image, then rows (year, title, description, tags, thumbnail) on hairlines. Mobile is designed at 375px first: 44px targets, safe-area insets on floating glass, no hover-only content, `srcset` images, the nav pill unfolds into a menu sheet, horizontal gestures use `touch-action: pan-y`. The phone hero fills the first screen, so the hero text is the first thing painted and the featured image waits below the fold.

## Background

`components/backdrop/Backdrop.tsx`: one fixed WebGL layer behind the page showing out-of-focus real flower photographs (`public/botanical/own/`: hydrangea, daylily, cherry blossom) with slow wind sway, variable blur, and a dissolve into paper; text always sits on calm paper. Still frame under reduced motion; plain paper without WebGL. Art direction and placement rules: `botanical-backdrop.md`; credits: `public/botanical/CREDITS.md` (the CC BY cherry blossom keeps its footer credit).

## Imagery and the image edge

Photos are real, natural, graded to the palette, with real alt text. **Image edge:** featured and thumbnail images (`components/shader-image`) dissolve into paper through a smootherstep feather: a watercolor fade, never a tear. Only the outer ~4% of each side fades (at most 12 to 32px), the edge wanders by a few pixels at most, and the inner 88% or more of every dimension is untouched. Without WebGL or JS, the `<img>` wears a matching soft CSS mask. GL work registers after first paint (idle), so it never delays LCP. Corners elsewhere: `radius-md`, no borders, no shadows.

## The work line

The hero's last line (`components/site/HeroHook`): a fixed stem (`profile.hookStem`) plus a rolling phrase taken from each post's `hook`. Words turn rather than slide; drag or swipe turns it 1:1; each phrase links to its page. Arrows appear only on the current phrase.

## Micro-UI kit (`components/ui`, see `docs/micro-ui/`)

Timeline (scrubbable, leaf buds on a hand stroke; a plain list stays in the HTML), StatusSlot (the nav pill grows in place to show reading or scrubbing progress, Dynamic-Island style), Gallery with PageControl (drag or keys, no autoplay by default, seeds for pages and a leaf for the current one), SegmentedControl and FilteredWork (filter that retargets mid-animation), FactRows (hairline rows), Disclosure, PreviewLink (glass preview that grows out of the link and folds back), NumberRoll, ReadingToc. All motion goes through `lib/motion/spring.ts`.

## Glass

Thin convex lens: refraction at the rim, frost, vibrancy, tint, specular rim, `shadow-glass` (the only drop shadow). Shapes in one `GlassEffectContainer` merge when close. Use the API in `components/glass/README.md` (`Glass`, `glass.regular.interactive()`, `GlassFold`, `GlassButton`); it falls back to a finished frosted look without WebGL and respects reduced motion, transparency and contrast. Dev showcase: `/glass` (dev only).

## Shape language

Decorative elements never use primitive shapes: strokes have pressure, blobs have seeded harmonics, leaves are asymmetric, page-control seeds each differ. Controls keep clean geometry: pills, 44px targets, 1px hairlines (or the hand-drawn hair that links and fact rows rest on). Lucide icons at 1.5px stroke, 20px. The halmic mark is the favicon and a 24px footer mark.

## Motion

**The law: incredibly subtle, tasteful and slow; simple shapes and simple tweens are unacceptable.** Timing ladder (CSS tokens in `app/globals.css`, crafted easings in `app/styles/craft.css`):

| Token | Value | Use |
| --- | --- | --- |
| `--motion-press` | 100ms | instant response; ink starts exactly under the finger |
| `--motion-fast` / `--motion-ui` | 320ms / 520ms | hover colour, focus, small state changes |
| `--motion-slow` | 1200ms | reveals |
| `--motion-slower` | 2400ms | large settles, featured imagery |
| `--motion-ambient` | 8 to 20s | slow drift |
| `--craft-out`, `--craft-in`, `--craft-spring`, `--spring-row` | easings | sampled `linear()` springs with 1 to 1.5% follow-through |

Limits: max travel 12px, scale delta 2%, opacity is the primary channel. No scroll-jacking, no scroll snapping, no pinned sections. Reduced motion: no transforms, instant opacity, still backdrop.

**Craft checklist (every animated thing, `docs/motion/craft.md`):** two overlapping motions; an organic silhouette; asymmetric in and out; a nameable physical reason; interruptible with kept velocity. **Interruptible and 1:1:** one spring utility (`lib/motion/spring.ts`, velocity-aware) for JS motion, CSS transitions for A to B; drags track the finger and carry release velocity; nothing locks input.

In production: the name settles on SettleText's three springs sampled to CSS (`NameHeader`), links rest on a hand hair and draw a moss tendril on hover, presses leave ink (`InkLayer`), row hover settles on `--spring-row`. Optional, off by default, for the owner: `?petal=1` (a tumbling petal, `DriftingPetal`) and `?leaf=1` (a drifting leaf shadow).

## Textures

Paper grain (160px tile, 4%, multiply on birch, soft-light on basalt, painted on `<html>`), hairlines, soft image edges, glass as the only shadow. All static and cheap.

## Release hygiene

Dev routes (`/write`, `/mood`, `/micro`, `/motion`, `/ui`, `/shaders`, `/glass` and `/api/write`) use `*.dev.tsx` page files that exist only under `next dev`; they must never appear in `npm run build`. Static HTML carries all content (timelines, galleries and filters degrade to plain lists).
