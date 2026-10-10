Paper is the visual system for michal.us: printed matter in a northern landscape. A birch-paper page, basalt ink, moss for the one living accent, a quiet lidar scan of Icelandic terrain behind it, and liquid glass reserved for the few things that float. Everyone reading at the same time is present — as a trail in the scan and a point on a small dotted globe — but never announced.

## Principles

- **Paper and nature.** The page should feel like a well-made printed object left outside on a clear day: warm off-white stock, dark ink, a little moss. No neon, no gradients, no glow.
- **Restraint, at scale.** Borrow the confidence of Apple and SpaceX product pages: very large type, generous space, one idea per screen, imagery allowed to be big. Remove anything that doesn't earn its place — labels, badges, counters, decoration.
- **Flat page, floating glass.** Content sits directly on `paper` with no cards, boxes or shadows. Liquid glass is only for chrome that hovers: the nav, its presence dots, buttons, the editor toolbar, menus.
- **Together, quietly.** Presence is felt, not reported. Visitors appear as trails and globe points in their `presence-*` color. No live counters, no "N here now", no names, no chat.
- **Frutiger Aero, lightly.** Airy, glossy, sky-and-water optimism: light grounds, clear glass, a little living green and water-blue. Restrained to a hint, never skeuomorphic clutter.
- **Best work first.** Order by significance, not date. Supporting material (progress logs, notes) lives underneath the thing it supports.

## Content fundamentals

- First person, plain, a little playful — the old site said *"don't (or do) judge it too harshly"*. Keep that warmth; cut filler adjectives. Short declarative lines.
- Sentence case everywhere. **No uppercase text anywhere** — no eyebrows, no all-caps labels, no letter-spaced small caps.
- The name is **Michał Bodzianowski** (with ł). URLs, handles and file names stay ASCII (`michal.us`). The nickname **halmic** is always lowercase; the studio is **Halmic Ltd**.
- No emoji in titles or UI.
- Spec lines (year · stack · role) and dates are small serif text in `ink-muted`, joined with ` · `.

## Color

- **Birch** (light) is the default and the only theme on the landing page and index pages (`/`, `/projects`, `/writing`): a light, comforting first impression. **Basalt** (dark) exists only for reading — project pages, progress-log entries and blog posts — where it follows `prefers-color-scheme` with the same roles. Reading layouts opt in with `<html data-reading>` (set by `<ReadingTheme/>`, before first paint); dark tokens live under `:root[data-reading]` in the generated `tokens.css`. `viewport.themeColor` is light everywhere except reading pages.
- Ground is `paper`; reading text is `ink`; secondary text is `ink-muted`. Those are the only text colors.
- `ink-faint`, `dot` and `hairline` are for marks, never text.
- `accent` is moss: link hover, the scanline, your own presence ring, at most one highlighted word per screen.
- `focus` is glacier water: a solid 2px ring, 2px offset, on every interactive element.
- `presence-1…6` — moss, glacier, lupine, puffin, sulfur, rhubarb — belong to visitors. Assigned on arrival, kept for the session, used only for trails, globe points and presence dots.

## Type

- **Schibsted Grotesk** (`sans`) for the name, titles, section heads, nav and buttons. Large and tight: negative tracking at display sizes as set in the styles.
- **Newsreader** (`serif`) carries the voice: `intro` for the hero and section intros, `prose` / `prose-lede` for articles, `meta` (italic) for dates, captions and reading time, `spec` (upright) for project spec lines. Use its optical-size axis.
- **IBM Plex Mono** (`mono`) for `code` only. It appears nowhere else.
- The home page opens with `display-name` — the full name on two lines, flush left — then one `intro` paragraph. No label above it, no logo lockup beside it.
- Article measure 62–70ch. Never set prose in the sans.

## Layout & spacing

- One column of content on a 12-column grid; max content width 1120px, prose 66ch. Featured imagery may go full-bleed.
- Gutters: `space-4` on phones, `space-8` from 768px. Section rhythm `space-16`, hero to first section `space-24`.
- Work is presented as an editorial index, not cards: a featured project with a large image, then rows (title, one-line description, `spec` line) separated by `hairline`.
- A project's progress log sits under the project, not in Writing; Writing is reserved for standalone essays.

## Mobile

Mobile is first-class, designed at 375px before desktop: 44px tap targets, safe-area insets on floating glass, no hover-only content, images sized for phones via `srcset`, the nav pill unfolds into a full menu sheet, touch drags never hijack vertical scroll.

## Liquid glass

A thin convex lens: refraction at the rim (squircle profile, Snell n = 1.5, slight RGB dispersion), frost (`glass-blur`), vibrancy (`glass-saturate`), `glass-tint`, a specular rim (`glass-rim` / `glass-edge`) and `shadow-glass` — the system's only drop shadow. Shapes inside one container merge liquidly when close and split when apart. Full refraction in Chromium; a finished frosted fallback everywhere else. Respect reduced motion, reduced transparency and increased contrast. Radii: `radius-lg` panels, `radius-pill` buttons and the nav.

## Shape language

- Decorative and presence elements avoid primitive shapes — no perfect circles, plain dots or hard rounded rectangles. Use blobby, floral, organic curves, hand-drawn strokes and real textures instead.
- UI controls keep clean geometry for usability: pills, `radius-md` image corners, 1px hairlines, 44px targets.
- Content is flat on paper: no cards, no drop shadows (glass's `shadow-glass` is the one exception).

## Lidar field, globe & presence

- **Field:** a full-viewport point cloud of Icelandic terrain — basalt plateaus, fjord ridges, a flat glacier band — in `dot` and `ink-faint`, with a moss scanline every ~6s and, rarely, a faint glacier-colored aurora band far off. Calm and sparse; drops to 40% behind articles.
- **Globe:** a quiet globe where a Mii-style toy avatar of Michał greets visitors. Visitors appear as little ghosts in their `presence-*` color (city-level from Cloudflare; never IPs). One serif `meta` caption at most. Presence is felt, never counted: no live counters, no "N here now", no names, no chat, and no presence chip in the nav.
- **Trails:** each visitor's pointer may leave a short fading trail in their color.
- Still frames under `prefers-reduced-motion`. A fuller art direction (`mood.md`) will supersede the details here.

## Imagery

- Photos are natural and unfussy; backgrounds lean toward the palette. Every image has real alt text and a caption where it helps.
- Covers are real images or absent: no stock art. Without a cover, layouts omit the image and the generated Open Graph card is used.
- The lidar-portrait idea is cancelled; the avatar on the globe replaces it. Corners are `radius-md`, no borders, no shadows.

## Iconography

- Lucide at 1.5px stroke, 20px, in `ink` or `ink-muted`. No filled icons, no emoji as icons.
- The halmic mark (`assets/Logos`) is the favicon and a 24px footer mark only: `halmic-mark-ink.svg` on Birch, `halmic-mark-white.svg` on Basalt.

## Motion

**The law: incredibly subtle, tasteful and slow.** Apple-style scroll animation without scroll-jacking. Thoughtfulness in each texture. Simplicity with subtlety.

CSS tokens (defined in `app/globals.css`):

| Token | Value |
| --- | --- |
| `--motion-fast` | 240ms — hover color, focus, small state changes |
| `--motion-slow` | 900ms — reveals, image hover settle |
| `--motion-slower` | 1400ms — featured imagery |
| `--motion-ambient` | 8–20s loops (lidar scanline, aurora) |
| `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-in-out-soft` | `cubic-bezier(0.45, 0, 0.15, 1)` |

Limits: max travel 12px, max scale delta 2%, opacity is the primary channel.

Rules:
- Nothing bounces, nothing loops fast, nothing moves more than a few pixels, one thing moves at a time. Ambient motion is slow enough to be noticed only on second look.
- **No scroll-jacking.** Never intercept wheel or touch, no scroll snapping on the page, no pinned sections that hold the scroll, native momentum untouched.
- **Scroll reveals** tie progress to scroll position with CSS scroll-driven animations (`animation-timeline: view()` / `scroll()`). Section headings, featured project blocks and index rows ease in over the first ~25% of their entry (opacity 0 to 1, 12px of travel). Featured images settle from 1.02 to 1 scale, clipped inside their frame, never moving layout. The home intro fades slightly as you scroll away. Where `view()` is unsupported, `<ScrollReveal/>` plays the same movement once via IntersectionObserver (rows stagger by at most 50ms). Opt in with the `.reveal` class.
- **Route change:** content fades up 8px over 600ms. Hover color transitions 240ms.
- **Glass:** press stays responsive; hover scale at most 1.015 on a slower spring (the glass component owns its internals).
- **Reduced motion:** no transforms, no scale, instant opacity; state changes are instant cross-fades.

### Fluid interaction

Interactive motion follows Apple's principles:
- **Interruptible and redirectable.** Any animation can be interrupted at any moment and retargets from its current on-screen value and velocity: never snap to the end state, never queue, never block input until it finishes. Stateful UI uses CSS transitions (they retarget from the computed value). JS-driven motion uses `lib/motion/spring.ts` (a velocity-aware spring, no dependency) and `useSpring`. Default is critically damped (ratio 1, response 0.4–0.6s); a hint of bounce (ratio about 0.85) only when the user imparted momentum, e.g. a fling.
- **Instant response, 1:1 tracking.** Drags follow the finger from the first frame (only direction detection first). On release, project momentum from the release velocity to choose the destination (dismiss or stay) and carry that velocity into the settling spring.
- **Reversible and spatially consistent.** Things return the way they came: the lightbox image grows from and returns to its thumbnail; the menu sheet folds back into the nav pill. A gesture can be reversed mid-flight.
- **Input is never locked.** Buttons and links stay tappable during transitions; closing can begin while opening is in progress.
- **Rubber-banding** instead of hard stops at drag limits. Scroll-jacking stays forbidden.

## Textures

Each texture has a reason; all are static, cheap and sit under content.
- **Paper grain** — so flat color reads as paper, not screen. A 160px tiled noise (`public/textures/grain-*.png`) at about 4%, `multiply` on Birch and `soft-light` on Basalt, painted on `<html>` beneath everything, so never over images, text or glass. No filters, no animation.
- **Hairlines** — 1px `hairline`, the quietest way to separate rows without boxes.
- **Image edges** — `radius-md`, no borders, no shadows, so photos sit on the page like prints.
- **Glass** — the only drop shadow, because only floating chrome should lift off the page.
