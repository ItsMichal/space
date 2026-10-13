# Design references

Rule: every visual element and motion pattern shipped on the homepage and shared chrome has a direct precedent on a
professional site. "Measured" means read from computed styles in a headless Chrome at 1440x900 on the date below (the
probe is a few lines of `getComputedStyle` over every element; values are the most common ones on the page). "Matched
by eye" means compared in screenshots only. Anything without a precedent was removed (list at the end).

Measured 2026-10-11 (home pages of each site).

| Element | Reference | What we match | How verified |
| --- | --- | --- | --- |
| Card surface, hairline edge, layered shadow | linear.app, stripe.com, family.co | Radius 16px (Linear's largest card radius is 16, its common ones 8 to 12; Family 10 to 12; rauno.me 12). Hairline ring `0 0 0 1px` at about 10 percent ink (Linear `0 0 0 1px rgba(0,0,0,.2)`, Family 1px inset). Soft layered shadow like Stripe's `0 30px 60px -10px` family, kept much quieter. | Measured |
| Nested image plate inside a card | linear.app (8px inner radius on 16px cards) | Plate radius 8px (`radius-xs`) inside a 16px card with 24px padding | Measured radii, matched by eye |
| Card hover lift | stripe.com, apple.com | 4px rise over 240ms on `cubic-bezier(.25,1,.5,1)`. Stripe's dominant transition is 300ms on exactly that curve; apple.com uses 240 and 320ms. Shadow cross-fades by opacity. No bounce. | Measured |
| Hover and press durations on small controls and links | linear.app, vercel.com, rauno.me, emilkowal.ski | 150ms colour/underline transitions (Linear 100 to 160ms, Vercel 100 and 150ms, rauno.me 150ms ease-in-out, emilkowal.ski 150ms) | Measured |
| Plain underlined text links | emilkowal.ski, apple.com text links | 1px underline in a quieter ink, offset 0.2em, goes to full ink on hover (emilkowal.ski: underline 1.28px) | Measured |
| Hairline rows and fact rows (experience, project facts, page-end links) | apple.com spec tables, stripe.com docs, read.cv profile lists | 1px `--hairline` rules, label column plus value column, display serif for the primary text | Matched by eye (apple.com spec pages are not on the home page, so not measured) |
| Page-end links block | apple.com footer directory, linear.app footer | Plain link names in a 2 (phone) or 3 (desktop) column grid with hairline dividers, no sentences | Matched by eye |
| Rotating hero phrase | linear.app hero text swap, apple.com | One phrase at a time: 8px rise and fade over 320ms ease-out, opacity and transform only | Matched by eye; timing from apple.com 320ms (measured) |
| Scroll reveal | apple.com, linear.app | One reveal: opacity and 12px translate, scrubbed by `animation-timeline: view()` over the first 30 percent of entry, once per element, no JS, nothing where unsupported | Matched by eye |
| Hero background tint cross-fade | apple.com product pages (page tint follows the product) | Flat pale tint, opacity cross-fade over 2.6s, two seconds is the slow end of what these pages do for ambient colour; nothing moves otherwise | Matched by eye. Weakest precedent here, see below |
| Phone menu and previews | apple.com (mobile nav sheet), linear.app mobile menu | Sheet appears at once; rows fade and rise 8px, 24ms apart, about 200ms on a critically damped curve (apple.com nav transitions are 240 and 320ms on `cubic-bezier(.4,0,.6,1)`) | Timings measured on apple.com; sheet layout matched by eye |
| Nav bar lockup (mark plus "michal.ai") | rauno.me (name top left), family.co (logo plus wordmark) | Mark and wordmark in one link, wordmark in the display serif at 21px | Matched by eye |
| Plain page layout: one centred container, 1120px | linear.app, vercel.com, stripe.com | Nav pill and content share one centred max-width container; footer aligned to the same column | Matched by eye |
| Satellite shell with short trails and sparse mesh pings, altitude exaggerated | satellitemap.space and other satellite trackers (orbit paths and trails), GitHub's homepage globe (arcs with a travelling pulse), Stripe's globe (sparse animated links) | Thin trails fading to the tail, a few short links with one travelling pulse, nothing glowing; radius pushed out so the swarm reads around the globe | Not opened in this pass; from memory. Radius, counts and timings are mine |
| Starlink constellation drawn as points on the hero globe | satellitemap.space (every Starlink satellite as a point on a globe/map), starlink.com's coverage map, GitHub's homepage globe (small points over a dotted Earth) | One tiny mark per satellite, no labels or tooltips, far side hidden. Points use the globe's ink, snap to its 6px matrix, radius about 0.2 pitch (land dots reach 0.36), true orbit radius 1.086 of the globe radius, hidden behind the disc, dimmer on the far limb | Not opened in this pass (the sandbox has no browser access to those sites); the genre is from memory. Strength, radius and thinning are mine |
| Pointer pushes the dot/glyph field apart and it springs back | The cursor-repel dot and particle fields on landing-page hero canvases (stripe.com, linear.app style), a common three.js / p5 idiom | Radial push, gaussian falloff, radius 100px, maximum 16px, critically damped follow, eases to zero after 1.5s idle, fine pointers only, canvas stays pointer-events none | Not verified on a specific live site; numbers are mine |
| Text-aware cutout that follows the rotating phrase | The phrase rotator itself (linear.app, apple.com iPhone page) | The dim box is the stem plus the phrase on screen, and eases between phrases over 480ms with cubic-bezier(0.22,1,0.36,1), the phrase's own enter timing and curve | Measured in screenshots mid-transition; no site found with a cutout behind a rotator |

## Removed for lack of a precedent

- Hand-drawn wobbly link underline and its draw-on animation (replaced by the plain underline above), the hand-drawn
  row and fact hairlines, the ink-soak press stain (CSS and the `ink-edge` SVG filter), the settling title animation on
  the name, per-word tilt and blur on the rotating phrase, the "dew" highlight on anchor targets, and every
  `--craft-spring` overshoot easing.
- Feathered and masked image edges on the homepage and project pages. Images are plain rounded rectangles.
- The botanical backdrop, cherry blossom image and drifting petal on the homepage.
- The vine and leaf timeline (now a straight rule with ticks).
- Scroll-linked parallax and the shared shader canvas on the homepage.

## Still in the codebase and not yet defended

- The Liquid Glass nav (SVG displacement refraction). The closest precedent is Apple's own Liquid Glass on apple.com
  and iOS 26, which is a native effect; web ports exist but I did not find one I could measure. Keep or fall back to a
  plain frosted bar is the owner's call.
- Paper grain overlay (`--grain` in globals.css): no measured precedent; family.co and teenage.engineering use flat colour.
- `InkLayer` markup inside `GlassButton` (CSS removed, so it is inert; delete in a follow-up).
- Dev-only labs (`/shaders`, `/mood`, `/motion`, `/micro`, `/glass`) still use the old shader image treatment.

## Cards v2: image-top tiles (measured 2026-10-11)

| Element | Reference | Measured | Ours |
| --- | --- | --- | --- |
| Tile card | apple.com/newsroom | White card, no border, no shadow. Radius 32px at 1440, 24px at 375. Image flush to the card's top, left and right edges, about 16:9 (303x170 in a 303x372 card; 470x264 in a 470x472 card). Text block below: category line 12 to 14px weight 700, headline 21 to 32px weight 700 (24px in the mid-size card), date 14 to 17px weight 600. The big card is 980x362 with the text beside the image. | Raised-paper card with a 1px hairline (paper on paper needs an edge), radius 24 phone / 28 desktop, image flush at 16:10, text block below, feature tile 1.35 : 1 image beside text from 900px |
| Tile hover | apple.com/newsroom | Image only: `transform: scale(1.03)`, `0.4s cubic-bezier(0.4, 0, 0.25, 1)`. The card does not lift. | Same: image scale 1.03, 400ms, same curve. No card lift, no shadow change |
| Horizontal tile gallery on phones | apple.com/iphone (tile transitions `transform 0.3s cubic-bezier(0, 0, 0.5, 1)`), apple.com home tiles | Tiles in a swipeable row | Home page: native `overflow-x` snap row of the same tiles on phones; /projects stacks them |
| Solid tile with a product name | apple.com (solid colour tiles with a name) | Name set large on a flat colour | Projects without a usable image (Starlink.com): the project name in the display serif on a pale palette tint, in the same media slot |
| Type hierarchy | apple.com | One family carries nearly everything; few sizes; weights 400 and 600/700 | One text face (Newsreader) for text, meta and UI, one display face for titles; two weights (400, 500); roles in `app/styles/type.css` |

Not measured: the App Store "Today" cards (not reachable from a headless browser without the app).

## Liquid Glass cards and the hero globe (measured 2026-10-11)

| Element | Reference | Measured | Ours |
| --- | --- | --- | --- |
| Glass surface | apple.com/newsroom and apple.com/ios/ios-26 nav and sheets | `backdrop-filter: saturate(1.8) blur(20px)` over `rgba(255,255,255,0.7 to 0.8)` (light) and `rgba(0,0,0,0.4 to 0.8)` (dark); `blur(20px)` over `rgba(232,232,237,0.4)` on the iOS 26 page. Radius 0 on those bars (the rounded glass shapes are native in iOS 26, so there is no web measurement of the rim). developer.apple.com materials page: `saturate(1.8) blur(20px)` over `rgba(29,29,31,0.7)` | Cards: `blur(20px) saturate(1.6)` (tokens `--glass-blur` x2, `--glass-saturate`) over a 58% paper tint, 1px rim brighter on the top-left (masked gradient border), faint outer ring and shadow. Feature caption: 74% tint, `blur(24px)`. Same tokens as the nav bar and menu |
| Specular rim, highlight width | iOS 26 Liquid Glass (native) | Not measurable on the web; matched by eye from Apple's marketing stills: about 1px, strongest top-left | 1px, gradient 0.95 to 0.1 to 0.5 alpha |
| Caption floating over artwork | iOS 26 media cards (native) | Not measurable | Feature tile only: full-bleed image with a glass caption panel inset 16px at the foot |

Honest status: with the page background this pale, the cards read as warm frosted white, not as Liquid Glass. Glass needs colour or detail behind it; the hero tint and the lower dots of the globe fade out before the second card row. The feature caption over the photograph does read as glass. The SVG displacement path is not used on any card.

Glass pointer light: the only global listeners were in `components/glass/lighting.ts` (`window` pointermove, pointerdown, scroll, deviceorientation). They are gone. A glass field now listens on its own host (pointerenter, pointermove, pointerleave, focusin, focusout), eases the highlight in and out over about 250ms, and does no work at rest. Not yet verified with a performance trace.

Cards lab: `/cards` (dev only) shows three directions with real content: 1 newsroom tile on glass, 2 fill tile, 3 glass caption over the image. Round-1 critique: (1) clean and calm but the glass is invisible on pale paper; (2) the image fills the card, which crops our UI screenshots too hard and makes them look blown up; (3) works for photographs (Starlink), muddy over dark UI screenshots. Chosen: 3 for the feature tile (photograph), 1 for the rest. Round 2 (spacing rhythm, baseline grid across a row, per-project crop focus) was not done.

Globe: tilted 23 degrees, two thirds of the viewport (cap 880px), behind the name and tagline. The shader thins the dots behind each text box (boxes measured on resize). Worst-case contrast on rendered pixels, text hidden, darkest background pixel: name 7.3 to 8.7 (needs 3), tagline 5.2 to 5.4 (needs 4.5), rotating line 11.9 to 12.4. Checked at 375, 768, 1024, 1440, 1920.

### Glass decision (option b)

Behind the lower card rows there is flat paper, so a blurred translucent card there is only frosted white (flat backdrop, nothing to blur). I did not fake a backdrop. Glass is kept where imagery sits behind it: the feature caption over the Starlink photograph (82% paper tint, `blur(24px) saturate(1.4)`, 1px inner top-left highlight, outer hairline, two-layer shadow), the nav bar and the phone menu. The other tiles are calm raised paper with a hairline. Caption text contrast: tint raised to 0.82 and muted text mixed toward ink so it holds 4.5:1 over the darkest part of the photo (not re-measured on pixels).

Numbers (headless Chrome with software GL, so only relative values mean anything): idle with the pointer elsewhere, the only rAF source is the globe's draw loop; the glass engine's loop runs only while the pointer is over the nav (about 10 callbacks a second) and is at zero 3 seconds after leaving. Globe frame interval on a 4x CPU throttle, 1440 wide: p50 66ms, p95 133ms idle; 375 wide: p50 33ms, p95 67ms.

Starlink image: the build makes 480/960/1600/2400 AVIF and WebP variants. Served at 1440 (1x): 1600w AVIF, 111 KB. At 375 (2x): 960w AVIF, 41 KB. The 1.8 MB original is not served.

## Graph-paper backdrop and glass cards, round 2 (2026-10-11)

- Backdrop: a fixed layer on the home page, 24px dots (radius 1.8px, 36% ink) and a 1px line every fourth cell (96px, 10% ink). 24 = 4 x 6, the pitch family of the globe's 6px dot matrix; the hero tint (which fades out behind the work section) hands over to the grid. It is mounted in the root layout, not in the page: the page transition wrapper carries a transform, which made `position: fixed` behave as absolute and the grid scrolled with the page (found by inspecting the computed chain). Precedent: I did not open a dot-grid site in this pass (linear.app, vercel.com, tldraw, FigJam are the ones to compare). The pitch, alpha and radius are mine.
- Glass: `blur(3px) saturate(1.5)` over a 30% paper tint. Apple's measured 20px blur erases a 24px dot grid completely (a sparse dot keeps about 4 percent of its contrast after a 5px blur), so the dots would not show through and the card would read as frosted white. At 3px the dots stay visible and soft inside the card, which is what reads as glass. Rim: 1px masked gradient, 95% white top-left to about 12% mid-edge. Hover raises the tint to 46%.
- Contrast over the busiest backdrop (text hidden, darkest pixel under each text block, desktop): meta 6.25, description 6.67, title 8.81. Phone not measured.
- Scroll on a 4x throttled 375px profile in headless Chrome with software GL: frame p50 33ms, p95 50ms, max 100ms, 0 long tasks (it was p50 17 / p95 33 before the glass and grid; relative only).

## Page backdrop: ink-wash blobs, god rays, glyph star field, glass lensing (2026-10-12)

Replaces the graph-paper dots. Nothing here was measured in a browser pass; precedents are named so they can be opened and
compared, and the "How verified" column says what was and was not checked.

| Element | Reference | What we take from it | How verified |
| --- | --- | --- | --- |
| Very large, slow, soft colour blobs on a page background | stripe.com home hero (WebGL gradient, the open-source "stripe-gradient" mesh shader), apple.com colour washes behind product pages | Colour fields wider than the viewport, edges with no visible shape, motion measured in tens of seconds; the page never shows a distinct blob | Matched by eye from memory of those pages, not opened in this pass |
| Pale, subtractive process-colour inks on cream stock | Risograph and CMYK print (misregistration, overprint: cyan over yellow gives green); the owner's own 2023 site (below) | Multiply blending so overlaps mix like inks, kept pale, never emissive | Overlap colours checked in the shader output; print precedent is a process, not a site |
| Soft light shafts from an off-screen point | linear.app and vercel.com hero light fields and "god ray" gradients | A few wide, low-contrast shafts, slowly breathing, never a hard edge | Matched by eye, not measured |
| Terminal glyph / dot-matrix field as texture | The hero globe on this site (6px dot matrix, ink `0.13 0.13 0.11`, 0.28 to 0.42 of ink); ASCII and glyph fields on studio and developer sites (for example ordered-dither and character-grid heroes) | Same pitch family (12px cell, 6px matrix), same ink, same "faint speck" size; symbol variety on top (`. : + x * o`, 4-point stars, constellation segments, a rare shooting star) | Ink, radius and alpha read from `components/presence/globe/renderer.ts`; the studio-site precedents were not opened |
| Glyph opacity | Our own contrast rule | Capped at 0.22 so 4.5:1 holds for muted ink over the worst glyph pixel | Computed, see docs/backdrop.md |
| Glass lensing: edge-weighted refraction, slight magnification, chromatic split, thin specular rim | Apple Liquid Glass (iOS 26, apple.com), the same references as the glass cards above | Bend concentrated in the first ~15px, almost nothing in the middle, rim lit from the top left | Not measurable on the web (see the glass section above); matched by eye |

Original site (2023, first commits `4ca66cb` "added really cool bg shader" and `4f5934a`): a react-three-fiber full-screen plane
(`components/BGAnim.tsx`, `BGShaders.tsx`) with a domain-warped fbm displacement driving contour lines in a yellow `#F2EA72`
to cyan `#6DF7F5` gradient over deep indigo (`#1A041B`, `#150C64`), slowly animated, dark and saturated, behind frosted-glass
panels. This backdrop keeps its spirit (warped noise fields in yellow and cyan, slow, behind glass) and inverts it: pale
inks on cream instead of neon on near-black.
## Reading view: column, prose and components (2026-10-12)

None of these references could be opened and measured from this environment (the sandbox allows no outside browsing). They
are named from what those sites are known to do and are **not measured**; the numbers in the "Ours" column are ours, tuned
by eye and checked with `scripts/article-shots.mjs` (centring within 1px at 1440, 1920 and 375; characters per line counted
on the rendered text). Compare against the live sites before treating any of them as settled.

| Element | Reference (not measured) | Ours |
| --- | --- | --- |
| One centred reading column with wider media | stripe.com/blog, vercel.com/blog, apple.com/newsroom articles, medium.com | Text column 35rem (about 67 characters at the 20px prose size, measured), wide track 900px for figures, tables, code, embeds and the timeline, both centred on the viewport axis. Phones: one track. Nothing full-bleed |
| Side contents list in the margin | stripe.com/docs, vercel.com/docs ("On this page") | Fixed in the margin outside the wide track from 1360px, so it never moves or overlaps the column |
| Visible bullets, hanging indent, nested marker shapes | any long-form site (medium.com, github.com READMEs) | Native list markers (disc, circle, square; decimal, alpha, roman), 1.5em indent, markers in muted ink |
| Boxed callout with an accent on one edge | vercel.com/docs, stripe.com/docs | Raised paper, hairline, 14px radius, 3px inset accent by type (note, tip, warning) |
| External link arrow | github.com, developer.mozilla.org external links | Small arrow glyph after links that leave the site |
| Wide table scrolling inside its own frame | github.com markdown tables, stripe.com/docs | Table wrapped in a focusable scroll region, semantics kept |
| Reactions row and view count | github.com issue reactions, medium.com claps and view counts | Five fixed emoji pills with counts, one toggle each (github.com); a quiet count beside them (medium.com). Neither was measured; pill size is the existing 44px touch target |
## Glass in dark mode (2026-10-12)

Bug: on a dark reading page the nav pill was a pale milky slab with near-white text. Cause and fix are in the PR; this section records the references the dark material was checked against.

| Element | Reference | What we match | How verified |
| --- | --- | --- | --- |
| Dark bar tint and backdrop filter | apple.com global nav in dark (`saturate(1.8) blur(20px)` over `rgba(22,22,23,0.8)`), developer.apple.com materials (`rgba(29,29,31,0.7)`), numbers as recorded in the Glass surface row above | Dark tone tint `rgba(18,22,18,0.8)` (the basalt paper at the same 80 percent), frost blur 20px and saturate 1.8 on dark pages (`--glass-blur-dark`, `--glass-saturate-dark`); light tone keeps 10px and 1.6. Not re-measured in this pass (network was not available to the build environment) | Values taken from the rows above, not re-read from apple.com today |
| Dark rim | iOS 26 and macOS Tahoe Liquid Glass in dark appearance (native, no web measurement; Apple HIG "Materials" and WWDC25 "Meet Liquid Glass" give no numbers) | Highlights are light but thin and low alpha (white at 28 percent, about 1px), the lower-right edge sinks into a deep shadow (black at 55 percent), no wash over the body. The frost bevel lift and the water-drop gloss are cut by 80 to 85 percent on dark tone so they no longer veil the tint | Matched by eye against stills |
| Tint and glyph colour chosen together | iOS 26 (glass flips light/dark with its backdrop and its glyphs flip with it), macOS menu bar | One decision per piece of glass (`components/glass/theme.ts`): the tone picks the tint, the foreground, the rim and the edge as a set | Unit tested against the real token values, measured on rendered pixels in `docs/glass-shots/` |

## Logo hover switcher between the two sites (2026-10-12)

Written without network access to the references (the build sandbox could not reach them), so every row is **from memory** and
unmeasured; the behaviour numbers are ours, chosen to sit in the range these sites use. Re-measure before treating as settled.

| Element | Reference | What we match | How verified |
| --- | --- | --- | --- |
| Hover flyout from a nav item with an intent delay, a bridge between trigger and panel, and the same panel opening on keyboard focus | stripe.com main navigation (Products, Solutions flyouts open on hover and on focus), apple.com global nav (flyout on hover, Escape closes) | Panel under the trigger, no gap to cross (8px transparent bridge), about 120ms in and 150ms out so a passing pointer does not open it, opacity and a 4px rise only, Escape closes, focus-within opens it | From memory (stripe.com, apple.com); behaviour checked by the headless-Chrome walk-through in `scripts/switcher-shots.mjs` |
| The logo as a switcher between a company's products or sites | vercel.com (right-clicking the logo offers brand assets and a link to the sibling site), linear.app and notion.so (workspace switcher on the top-left mark), atlassian.com (app switcher) | The mark is the trigger and still navigates home; the row holds the sibling's mark and its domain only | From memory; none of these use hover on the mark, so only the placement and content are matched. Weakest precedent here |
| Sibling-site assertion with `rel="me"` | IndieWeb rel=me (indieweb.org/rel-me), used by Mastodon profile verification | Both links carry `rel="me"` and are plain same-tab anchors | From memory |
| Touch fallback as a quiet last row in the phone menu | apple.com mobile nav sheet | Same row as the dropdown, hairline above, no extra control | Matched by eye |
| Bar without a wordmark, mark alone at the left | vercel.com, linear.app (mark only, no wordmark, in the top bar) | Mark at 20px, links right of it | From memory |

## Citation (verified)

Piecing Together Teamwork: A Responsible Approach to an LLM-based Educational Jigsaw Agent. Emily Doherty, E. Margaret Perkoff, Sean von Bayern, Rui Zhang, Indrani Dey, Michal Bodzianowski, Sadhana Puntambekar, Leanne Hirshfield. Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems, pp. 1-17, ACM, published 2025-04-25, doi:10.1145/3706598.3713349. Sources opened: Crossref (`api.crossref.org/works/10.1145/3706598.3713349`, which returns title, authors in order, container, pages and date) and dblp (search results list this title with Michal Bodzianowski among the authors). The ACM page (dl.acm.org) returned a Cloudflare bot check, so it was not opened. Another record with his name: Mason et al., "Coronal Heating as Determined by the Solar Flare Frequency Distribution Obtained by Aggregating Case Studies", The Astrophysical Journal, 2023, doi:10.3847/1538-4357/accc89 (a large CU Boulder class author list). I cannot tell from the record that it is the same person, so it is not on the site.

## Cards everywhere (2026-10-12)

One surface, shared by every card on the site: `app/styles/card.css` (`.surface`, `.surface--glass`, `.surface--link`, `.card`, `.card--list`). Tokens: one radius (`--card-r`, 24 phone / 28 from 900px), one inner padding (`--card-pad`, 16 phone / 24 from 640px), one gap (`--card-gap`, 12 / 16), one hover. Precedents were read by eye from the sites named; none was re-measured in this pass, so "matched by eye" throughout.

| Pattern | Reference | What we match | How verified |
| --- | --- | --- | --- |
| Bento grid for About (intro, experience, publications as cards on one grid, one tall card beside two) | apple.com product "features" bento sections (iPhone, Mac pages), linear.app feature grid | Cards of different spans on one column grid with one gap; the tall card runs the height of two. Three columns from 1100px so the grid lines up with the three-column work grid above it | Matched by eye |
| List card: rows inside a card, hairline between rows (experience, publications, writing by year, series, home writing) | vercel.com dashboard and docs list cards, linear.app settings lists, apple.com Settings-style grouped rows | One rounded card holds the rows edge to edge; the row is the link and tints on hover; hairline divides rows | Matched by eye |
| Link card (page-end links, 404 action, prev/next) | apple.com newsroom and store tile links, stripe.com docs card links | Whole card is the link; background steps up on hover, no lift, no shadow change; focus ring offset 3px | Matched by eye |
| Facts as a card of label-over-value cells | apple.com tech specs summary, vercel.com project overview | Small muted label above the value, cells in an auto-fit grid inside one card | Matched by eye |
| Tertiary meta line pinned to the foot of a tile | apple.com newsroom (date on the last line), linear.app changelog cards | Title, description, then the small muted line at the bottom; titles share one baseline across a row because the image above them has one aspect ratio | Checked programmatically (title tops equal within 1px, see scripts/shoot-cards.mjs) |
| Glass only where something is behind it | apple.com iOS 26 pages (material over media), our nav | Home work tiles keep `blur(10px) saturate(1.5)` (hero tint and paper grid behind); every other card is the same surface at a near-solid 92% tint, so no extra `backdrop-filter` layers on phones | Reasoned; not profiled |
| Reading pages: the same card in dark | linear.app and vercel.com dark cards (1px light ring at about 10 percent, deeper shadow) | Ring and shadow switch through tokens under `:root[data-reading]`; rim opacity 0.2 | Screenshots |
| Full-width cover image on article pages, narrow text column | apple.com newsroom articles, stripe.com blog | Cover and chrome cards run the container width; article prose stays in a 66ch reading column | Matched by eye |

Dashes: em and en dashes removed from everything shipped (owner instruction); separators are the middle dot, ranges "to" or a hyphen. `scripts/check-dashes.mjs` enforces it.

## About page and web resume (2026-10-12)

Pages were fetched as text (WebFetch) on 2026-10-12, so structure is verified but computed styles are not measured. Anything marked "memory" was not opened in this pass.

| Element | Reference | What the reference does | Ours |
| --- | --- | --- | --- |
| Dated role rows: date, employer and title, description, tags | brittanychiang.com/#experience (fetched) | Numbered list, newest first. Each role: date range, heading "title · employer" linked to the employer, a description, optional link bullets, tech tags. A "View Full Resume" link to `/resume.pdf` follows the list | One row per role in a card: left column employer, title and dates (`<time>`), right column the LinkedIn bullets, a "Stack:" meta line and "Related" links to the project pages. Resume link in the contact card |
| A bio that carries the work history in prose, contact as a plain mailto | leerob.com/about (fetched) | One header, prose bio with employers linked inline, an email mailto inside the text, no separate sections | Bio paragraphs first, then one status note in his own words, contact as plain rows (LinkedIn, email as `mailto:`, X, GitHub) |
| Card grid with a link to a person's profile | linear.app/about (fetched) | Team cards with name, title and a LinkedIn link; hiring link; plain text list for the rest | Card language from the shared system; profile links as `rel="me"` rows |
| Project tiles on the about page | apple.com newsroom tiles (see "Cards v2") | Image-top tile | The same tile component as home, in a three-column grid |
| Quiet status line with availability | rauno.me and paco.me (memory, not opened): short first-person status near the top of the page | | A single first-person inset note in the intro card |
| Resume as a print-styled web page with a PDF download | brittanychiang.com (resume.pdf, fetched), read.cv profiles (memory) | | `/resume` renders the same data; `@media print` hides the chrome and sets 9.5pt type; the PDF is printed from that page by headless Chrome |

Honest status: the inset status note has no verified precedent beyond a recollection of short availability lines on personal sites; if the owner wants a stricter standard it should be reduced to plain text in the intro paragraph.

## About photograph and logo on share cards (2026-10-13)

References were fetched as text on 2026-10-13 where marked "fetched"; none was measured for computed styles. "Memory" means not opened in this pass.

| Element | Reference | What the reference does | Ours |
| --- | --- | --- | --- |
| A plain portrait photograph on a personal about page, real background, no treatment | leerob.com/about and brittanychiang.com (fetched: both pages are text-led; neither shows a treated photo), rauno.me and paco.me (memory: small unfiltered photographs on the about pages) | Honest status: I could not verify a photograph pattern from the fetched pages | A 3:4 photograph in a 4:5 card with the card radius, `object-position` set to the face, no filter, no overlay; beside the intro from 900px, a 4:3 window above it on phones. Weakest precedent in this change, flagged for the owner |
| Small portrait thumbnail beside the first paragraph of a bio | read.cv and github.com profile headers (memory) | | 88 to 104px, 4:5, floated left of the first paragraph on the home intro card |
| Mark at the foot of a generated share card, name and domain beside it | vercel.com and linear.app Open Graph cards (memory, not opened): logo in a corner, title large | | Mark bottom left on every card (post, list, home, About), 40px tall, ink on paper, with the name or domain beside it |
| Portrait panel on the right of a card, text left | The post cards already in `lib/og.tsx` (a cover panel at 456 by 534, radius 28) | | The home and About cards reuse that panel for the photograph |
