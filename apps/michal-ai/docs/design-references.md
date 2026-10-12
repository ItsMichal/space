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
