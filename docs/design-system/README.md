Paper is the visual system for michal.us: printed matter in a northern landscape. A birch-paper page, basalt ink, moss for the one living accent, a quiet lidar scan of Icelandic terrain behind it, and liquid glass reserved for the few things that float. Everyone reading at the same time is present — as a trail in the scan and a point on a small dotted globe — but never announced.

## Principles

- **Paper and nature.** The page should feel like a well-made printed object left outside on a clear day: warm off-white stock, dark ink, a little moss. No neon, no gradients, no glow.
- **Restraint, at scale.** Borrow the confidence of Apple and SpaceX product pages: very large type, generous space, one idea per screen, imagery allowed to be big. Remove anything that doesn't earn its place — labels, badges, counters, decoration.
- **Flat page, floating glass.** Content sits directly on `paper` with no cards, boxes or shadows. Liquid glass is only for chrome that hovers: the nav, its presence dots, buttons, the editor toolbar, menus.
- **Together, quietly.** Presence is felt, not reported. Visitors appear as trails and globe points in their `presence-*` color. No live counters, no "N here now", no names, no chat.
- **Best work first.** Order by significance, not date. Supporting material (progress logs, notes) lives underneath the thing it supports.

## Content fundamentals

- First person, plain, a little playful — the old site said *"don't (or do) judge it too harshly"*. Keep that warmth; cut filler adjectives. Short declarative lines.
- Sentence case everywhere. **No uppercase text anywhere** — no eyebrows, no all-caps labels, no letter-spaced small caps.
- The name is **Michał Bodzianowski** (with ł). URLs, handles and file names stay ASCII (`michal.us`). The nickname **halmic** is always lowercase; the studio is **Halmic Ltd**.
- No emoji in titles or UI.
- Spec lines (year · stack · role) and dates are small serif text in `ink-muted`, joined with ` · `.

## Color

- **Birch** (light) is the default; **Basalt** (dark) follows `prefers-color-scheme` with the same roles.
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

## Lidar field, globe & presence

- **Field:** a full-viewport point cloud of Icelandic terrain — basalt plateaus, fjord ridges, a flat glacier band — in `dot` and `ink-faint`, with a moss scanline every ~6s and, rarely, a faint glacier-colored aurora band far off. Calm and sparse; drops to 40% behind articles.
- **Trails:** each visitor's pointer leaves a short fading trail of grid-snapped dots in their color.
- **Globe:** a dotted Earth in the same point style, showing where current readers are (city-level, from Cloudflare; never IPs) with dotted arcs to you. One serif `meta` caption beneath — e.g. *Right now, from Reykjavík, Berlin and Denver.* Iceland is the default view when you're alone.
- **Nav presence:** overlapping colored dots only, your own with a moss ring; a quiet serif popover on hover or focus. No count text.
- Still frames under `prefers-reduced-motion`.

## Imagery & portrait

- Photos are natural and unfussy; backgrounds lean toward the palette. Every image has real alt text and a caption where it helps.
- The portrait appears as a lidar point cloud that resolves into the photo — the same dot language as the field and globe — with the real image in the DOM for search and no-JS.

## Iconography

- Lucide at 1.5px stroke, 20px, in `ink` or `ink-muted`. No filled icons, no emoji as icons.
- The halmic mark (`assets/Logos`) is the favicon and a 24px footer mark only: `halmic-mark-ink.svg` on Birch, `halmic-mark-white.svg` on Basalt.

## Motion

- Springs for glass (press 0.97, hover 1.03); 120–200ms eases for color; content fades up 8px over 240ms on route change. Nothing else bounces.
- Everything respects `prefers-reduced-motion`.
