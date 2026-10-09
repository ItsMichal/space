Paper is the visual system for michal.us: a white, flat, editorial page with a living lidar scan behind it, a single sans-serif name header, and one material — liquid glass — reserved for things that float. Everyone on the site at the same time shows up in the scan as a small colored trail.

## Principles

- **Paper first.** The page is flat `paper`. No cards, no boxes around sections, no drop shadows on content. Structure comes from type size, spacing and `hairline` rules.
- **Glass floats, content doesn't.** Liquid glass is only for chrome that hovers over the scan and the page: the nav bar, the presence chip, buttons, the editor toolbar, menus. Never wrap a paragraph, a project or an image in glass.
- **The scan is ambient.** The lidar field sits behind everything at low contrast. It may move, but it never competes with text: dots use `dot` and `ink-faint` only, and the scanline uses `accent` for a few frames at a time.
- **Together, quietly.** Presence is a feeling, not a feature. Other visitors are trails of dots in their `presence-*` color; there are no names, no cursors with labels, no chat.

## Content fundamentals

- Write in first person, plainly, a little playful — the site already says *"don't (or do) judge it too harshly"*. Keep that voice.
- Sentence case everywhere: headings, buttons, nav. The only uppercase is the `label` style (eyebrows, presence count).
- The name is written **Michal Bodzianowski**; the nickname **halmic** is always lowercase. The studio is **Halmic Ltd**.
- Role line: *Creative developer* — AI, XR and the web, taking projects from 0 to 1.
- No emoji in titles or UI. Project titles in the old CMS carried emoji (🏔️ Project Mountaintop); drop them in Paper.
- Dates and tags are meta: set them in `meta` (mono), joined with ` · `.

## Color

- Ground is `paper`; text is `ink`; secondary text is `ink-muted`. Those two text colors are the only ones used for reading.
- `ink-faint`, `dot` and `hairline` are for marks, never text.
- `accent` is the scan laser: hover state of links and project titles, the moving scanline, at most one highlighted word per screen.
- `focus` is the focus ring, solid 2px with 2px offset, on every interactive element in both themes.
- `presence-1` … `presence-6` belong to visitors. A visitor is assigned one at random on arrival and keeps it for the session. Use them only for trails, presence dots and that visitor's own chip — never for UI states.
- Paper (light) is the default theme. Graphite (dark) follows `prefers-color-scheme` and keeps the same roles.

## Type

- **Schibsted Grotesk** (`sans`) for the name header, titles, UI and nav. Tight negative tracking at display sizes, as set in the styles.
- **Newsreader** (`serif`) for article reading only — `prose` for body, `prose-lede` for the lede. Use its optical size axis.
- **IBM Plex Mono** (`mono`) for `meta`, `label` and `code`.
- The home page opens with `display-name`: the full name on two lines, flush left, with the role line in `body` `ink-muted` beneath. No logo lockup next to it.
- Article measure 62–70ch. Never set prose in the sans.

## Layout & spacing

- One column of content, left-aligned on a 12-column grid; max content width 1120px, prose 66ch.
- Gutters: `space-4` on phones, `space-8` from 768px.
- Section rhythm: `space-16` between sections, `space-24` from the top of the header to the first section.
- Lists of work are **rows**, not cards: title + description on the left, `meta` on the right, a `hairline` between rows.

## Liquid glass

The material is a thin convex lens. Build it with `.lg` (or `Paper.liquidGlass(el)` for full refraction):

1. **Refraction** — an SVG `feDisplacementMap` driven by a map generated from the element's rounded-rect signed distance field. Within a rim band (`bezel`, ≈ the corner radius up to 24px) the surface height follows a convex squircle; its slope bends rays with Snell's law (n = 1.5), so the backdrop compresses toward the center at the edges. Scale is `glass-refraction`.
2. **Dispersion** — three displacement passes at ±6% scale for R, G and B, screen-blended, give a faint color fringe at the rim.
3. **Frost & vibrancy** — `glass-blur` then `glass-saturate`.
4. **Tint** — `glass-tint` fill.
5. **Edges** — inset 1px `glass-rim` top-left, inset 1px `glass-edge` bottom-right, plus a masked gradient ring for the specular highlight.
6. **Lift** — `shadow-glass`, the only drop shadow in the system.

Refraction runs only in Chromium (it supports `url()` inside `backdrop-filter`). Safari and Firefox get steps 3–6 — that fallback must look finished on its own. Regenerate the map when the element resizes. Respect `prefers-reduced-transparency` by raising `glass-tint` alpha to 0.9.

Radii: `radius-lg` for panels, `radius-pill` for buttons and chips. Pressing glass scales it to 0.97 with a springy curve; hover 1.03.

## Lidar field & presence

- A full-viewport canvas fixed behind the page. Points sample a slowly drifting terrain, projected with perspective; depth sets dot size and switches far points to `dot`, near points to `ink-faint`.
- A scan plane sweeps front-to-back about every 6s, lighting the points it crosses in `accent`.
- Grid pitch is `space-3` (12px). Visitor trails snap to that grid so they read as part of the scan.
- Each visitor's pointer is sampled ~15×/s and broadcast; peers render the last ~40 samples as dots fading by age (alpha ∝ age²) with a 4.5px head dot. Your own trail renders too.
- With `prefers-reduced-motion`, render one still frame and show trails as static dots.
- Behind article text the field drops to 40% opacity.

## Iconography

- Lucide (the site's existing icon set) at 1.5px stroke, 20px, colored `ink` or `ink-muted`. No filled icons, no emoji as icons.
- The halmic mark (`assets/Logos`) is used only as the favicon and in the footer at 24px tall. Use `halmic-mark-ink.svg` on Paper and `halmic-mark-white.svg` on Graphite.

## Motion

- Springs for glass (scale on press/hover), 120–200ms ease for color.
- Page transitions: content fades up 8px over 240ms. Nothing bounces except glass.
- Everything respects `prefers-reduced-motion`.
