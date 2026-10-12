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

## Citation (verified)

Piecing Together Teamwork: A Responsible Approach to an LLM-based Educational Jigsaw Agent. Emily Doherty, E. Margaret Perkoff, Sean von Bayern, Rui Zhang, Indrani Dey, Michal Bodzianowski, Sadhana Puntambekar, Leanne Hirshfield. Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems, pp. 1-17, ACM, published 2025-04-25, doi:10.1145/3706598.3713349. Sources opened: Crossref (`api.crossref.org/works/10.1145/3706598.3713349`, which returns title, authors in order, container, pages and date) and dblp (search results list this title with Michal Bodzianowski among the authors). The ACM page (dl.acm.org) returned a Cloudflare bot check, so it was not opened. Another record with his name: Mason et al., "Coronal Heating as Determined by the Solar Flare Frequency Distribution Obtained by Aggregating Case Studies", The Astrophysical Journal, 2023, doi:10.3847/1538-4357/accc89 (a large CU Boulder class author list). I cannot tell from the record that it is the same person, so it is not on the site.
