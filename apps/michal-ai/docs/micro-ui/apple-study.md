# Apple micro-interactions: notes for this portfolio

My own notes, no Apple assets or copy. Sources: a live pass over apple.com/iphone (desktop, headless Chrome; the shelf of cards with the next card peeking in at the right edge and the small dark round action buttons were what I could confirm by eye), and what Apple publishes in the Human Interface Guidelines and the WWDC talks "Designing Fluid Interfaces" and "Meet Liquid Glass". I did not get to watch every apple.com page (configurator, compare, events) interactively, so anything below about those is from the published guidance and from memory of the behaviour, flagged as such. Timings are my approximations, not Apple's numbers.

## The shared physics (from "Designing Fluid Interfaces")

- A response is instant: the view moves with the finger from the first frame, 1:1, and only then decides what the gesture means.
- Release is the interesting moment. Velocity is projected with a deceleration rate (about 0.998 per ms for a scroll view) to find where the motion *would* stop; that projected point picks the destination (the nearest detent), and the current velocity is carried into a spring that settles there.
- Springs are described by response (how quick it feels) and damping ratio. Critically damped (1) by default; a little bounce (about 0.8) only when the user threw something.
- Past a limit, content rubber-bands: the further you pull, the less it moves; release springs it back.
- Everything is interruptible and redirectable: touch during a settle grabs the thing where it is.
- Reversible and spatially consistent: it goes back the way it came.

## Patterns, how they feel, and how they serve this site

| Pattern | What it does and how it feels | Used here |
| --- | --- | --- |
| **Highlights gallery with page control** (apple.com product pages) | One big slide, neighbours peeking. Swipe tracks the finger; release carries momentum and lands on a slide. Below, a capsule of dots: the current dot stretches into a pill that fills as autoplay runs, with a play/pause beside it. Autoplay stops once you touch it. | `Gallery` + `PageControl`, project pages. Dots are organic seeds; the current page is a leaf-shaped pill that stretches toward its target with a pinched waist. |
| **Shelf of cards, next card peeking** | A horizontal scroller that shows a sliver of the next item so you know to swipe. Momentum native. | The gallery's neighbours; the timeline's faded neighbours. |
| **Sticky local nav that condenses** | A secondary bar that sits under the global nav, collapses its title as you scroll, and shows a section name. | `StatusPill`: the nav pill grows a second capsule with the current section and reading progress while you scroll, folds back at rest. |
| **Scroll-linked highlight lists** | Lines of text darken one by one as you scroll past (progress tied to scroll position, not time). | `ReadingToc` active item and its stem, tied to scroll, never intercepting it. |
| **Segmented control** (HIG) | A track with a thumb. The thumb follows a drag, can be flicked, lands on a segment; in iOS 26 it is a glass lens that stretches slightly while moving. | `SegmentedControl` on /projects (All, Web, AI, Games). Thumb stretches toward its direction, trailing edge lags. |
| **Page controls and scrubbers** (HIG) | Scrubbers keep a handle under the finger and ease to rest; detents give a tiny haptic tick when crossed. | `Timeline`: scrub, detents settle on the nearest item, a very short `vibrate(3)` where the platform allows. |
| **Sliders with detents** | Handle is free while dragging, snaps to marks on release with velocity carried. | Same logic (`settleIndex`). |
| **Dynamic Island** | A status pill that morphs: it expands to show an activity, shrinks back, two shapes can merge and separate (metaball). Width changes with a springy overshoot. | `StatusPill` lives in the nav's glass container so it merges with the pill at the seam; width follows text on a spring that overshoots slightly. |
| **Number roll transitions** | Digits roll vertically to the new value, each column slightly offset in time. | `NumberRoll`, once, when visible. |
| **Sheets with detents / pull-to-reveal / context-menu previews** (HIG) | A sheet rests at a few heights and flicks between them; long-press shows a preview that grows out of the pressed item. | `PreviewLink`: hover dwell or long-press shows a glass card that grows out of the link. (Sheets and pull-to-reveal: not needed on a static portfolio, not built.) |
| **Spec tables / compare** | Rows with a serif-ish label column and aligned values; rows fade in as they enter. | `FactRows`. |
| **Disclosure** | Rows expand with a soft spring, content settles in a beat after the box. | `Disclosure`, height on a spring so a second press reverses from the current height. |
| **Timeline-like pages (Newsroom / Events)** | A strip of dated items you can browse sideways. | `Timeline` (experience, progress log, Starlink launches). |

## What I changed for paper and nature

Apple's controls are crisp geometry. Here controls keep clean hit areas (44px) and clear state, but what moves inside them is drawn: stems have pressure, ticks are buds and blades, dots are seeds, pills have a waist. Springs are the same physics; the silhouette is not.
