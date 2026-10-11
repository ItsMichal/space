# Micro-interaction spec

Companion to `sites.md`. Everything obeys the design-system motion law: slow soft ease-out `cubic-bezier(0.22,1,0.36,1)` (`--ease-out-soft`), critically damped springs (`lib/motion/spring.ts`, `response` 0.4-0.6s, `damping` 1), travel at most 12px, scale at most 2%, opacity first, one thing moves at a time, every state change interruptible from its current value and velocity, a reduced-motion alternative, and a touch equivalent for anything hover. Timings use the ladder found in the research: **press 100-160ms, hover/color 240-400ms, reveals 0.9-1.4s, image arrival 2.4s, ambient 20s+**.

Priority: **must** / **nice** / **maybe**. Cost: **C** CSS only, **S** CSS + small script, **J** JS spring/rAF. "First ten" are marked ★ and are prototyped at `/micro` (dev only).

## Interaction philosophy (for the design system)

The site behaves like a printed object that is slightly alive: quiet until you touch it, then it answers immediately and settles slowly. Responses to a hand are *fast* (a press lands in 100ms), but the way things come to rest is *long* (colors warm over a third of a second, images finish arriving over seconds), so the page always feels attentive without ever feeling busy. Motion borrows from plants, not machines: lines grow and retract rather than slide, edges soften rather than snap, things lean toward you a degree and settle, and nothing loops faster than a cloud shadow. Only one thing moves at a time, nothing moves more than a few pixels, and every movement is interruptible: reverse it halfway and it turns from where it is. Anything that depends on hover has a touch equivalent on press, and with reduced motion each effect collapses to an instant, opacity-only change. If an effect is noticed on first sight, it is too loud.

---

## Catalog

### Links and text

**1 ★ Tendril underline** (links, nav items, footer links) · must · C
- Trigger: hover / keyboard focus-visible / touch press (`:active`). Retracts toward the *opposite* end on leave.
- Moves: a 1px `background-image` line (`linear-gradient(currentColor,currentColor)`) with `background-size` 0 to 100% at the bottom of the text; origin `left` on enter, `right` on leave, so it grows from the left and withdraws to the right like a vine that has passed through. Rest state keeps the existing hairline underline (`text-decoration-color: var(--hairline)`); the tendril overlays it in `accent`.
- Timing: 420ms `--ease-out-soft` grow; 320ms `--ease-in-out-soft` retract; color 240ms. Interrupt: transitions retarget from the current `background-size`.
- Reduced motion: instant swap to full-width `accent` underline. Touch: same on `:active`, no hover reliance, 44px target stays.
- Metaphor: a tendril reaching along a stem and withdrawing. Impl: pure CSS (`background-position` flip on `:hover` vs rest). Cost: free.

**2 ★ Settling title** (page/section titles, `display-name`) · must · S
- Trigger: first paint / route entry (once). Splits into lines (not letters), each line enters in order.
- Moves: `opacity 0 to 1`, `translateY(8px to 0)`, no scale; the second line begins 90ms after the first. Soft blur is avoided (it costs and reads as screen, not paper).
- Timing: 1400ms `--ease-out-soft`, 90ms stagger, 120ms initial delay. Replaces the generic 600ms fade-up for the *name only*; routes keep 600ms.
- Reduced motion: opacity only, 150ms. Touch: same. Metaphor: a sheet laid down onto a table, the heavier line landing a hair later. Impl: CSS animation with `animation-delay` per line (`--i`), no JS; a two-line `display-name` is already two spans. Cost: free.

**3 Ink-bloom focus ring** (focus-visible on links/buttons) · nice · C
- The 2px glacier ring does not appear; it blooms: `outline-offset` 6px to 2px and `outline-color` alpha 0 to 1 over 320ms `--ease-out-soft`. Reduced: instant. Touch: n/a (focus only). Metaphor: a drop of water finding its edge. Impl: CSS transition on outline (works in all current engines).

**4 Footnote dew** (footnote jump targets, heading anchors) · nice · C
- Trigger: `:target`. Moves: background `color-mix(accent 14%)` fading to transparent; a faint 2px left rule `accent` at 40% fades with it. 2400ms `--ease-in-out-soft`, hold 400ms. Reduced: static highlight, no fade; touch: same. Metaphor: dew that dries where you landed. Impl: `@keyframes` on `:target` only. ★-adjacent: included in the prototype as the tenth.

**5 Variable-weight lean** (inline links in prose, nav) · maybe · C
- From Union Boulangerie: transition a custom property on the font's weight/opsz axis by ±40 units over 300ms. Needs a variable face with a weight axis (Newsreader has one; Michelangelus does not). Risk: layout shift, so only with `font-variation-settings` on a width-locked inline-block. Cost: low; value: moderate. Likely cut.

### Buttons and controls

**6 ★ Ink-soak press** (primary/secondary buttons, glass buttons' inner fill) · must · S
- Trigger: pointer/touch down, location-aware. Moves: a radial gradient of `ink` (opacity 0.10) grows from the exact press point, `--x/--y` set from pointer coordinates, radius 0 to 140% of the button over 640ms; the label shifts `translateY(0.5px)`; button `scale(0.995)`. On release the stain fades 900ms rather than vanishing.
- Timing: press response 100ms to first visible pixel, soak 640ms `--ease-out-soft`, release fade 900ms. Interruptible: a new press restarts from the new point while the old one fades (two layers max).
- Reduced motion: background-color step 160ms, no spread. Touch: identical (pointer events). Metaphor: ink bleeding into pressed paper. Impl: pointerdown sets CSS vars + toggles a class; a `::before` with `background: radial-gradient(...)` and a transition on `--r` registered via `@property`. Cost: ~25 lines JS.

**7 Glass hover** · exists (spring, <=1.015) · listed for completeness; no change.

### Imagery

**8 ★ Breathing edge** (featured images, lightbox thumbnails, hero photographs with soft edges) · must · C
- Trigger: hover, focus within, touch press. Moves: a `mask-image` radial/linear feather whose inner stop moves 2-3% outward (the soft edge "inhales"), plus `scale 1 to 1.012` on the inner image. Rest = feathered edge blends into paper; engaged = slightly more image shows.
- Timing: 900ms `--ease-out-soft` in, 1400ms out (slow exhale). Interruptible: registered custom property `--feather` via `@property`, transitioned. Reduced: static mask, no change. Touch: `:active` plus a 1200ms hold for a tap.
- Metaphor: an out-of-focus petal edge pulling focus. Pairs with the owner's blossom photographs entering from the page edge. Impl: CSS `mask` with `@property --feather` (Chrome/Safari/Firefox 128+), graceful no-op otherwise. Cost: raster mask on large images, so only on `<=2` images per screen.

**9 ★ Slow arrival** (every featured/hero photograph, first view) · must · S
- Trigger: first time the image is >=20% in view (IntersectionObserver or `animation-timeline: view()`), once. Moves: `opacity 0 to 1` over 1400ms while `scale 1.02 to 1` and `translateY(8px to 0)` run 2400ms, so the picture is still settling after you've read the caption. No layout movement; clipped to its frame.
- Reduced motion: opacity 400ms. Touch: same. Metaphor: a print drying and flattening (the research's 8-10s settle, scaled by the 2% law). Impl: existing `.reveal` mechanism plus a longer variant `.reveal--image`. Cost: free.

**10 Blossom lean** (hero blossoms entering from the edge, botanical overlays) · must · J
- Trigger: pointer move over the section (desktop) or touch drag within it (mobile), tracked with a spring; also device tilt is **not** used.
- Moves: `translate(<=6px, <=6px)` and `rotate(<=1.5deg)` toward the pointer, relative to the element's origin at its anchored edge (so the stem stays put and the bloom leans). Far layers move 60% as much (depth).
- Timing: critically damped spring, response 0.9s (very soft), target updated on pointer move; on leave it settles to zero from its velocity. Reduced motion: no movement.
- Touch equivalent: pointer drag leans it the same way, never intercepts scroll (`touch-action: pan-y` stays).
- Metaphor: flowers noticing someone nearby. Impl: `useSpring` x2 (x,y) writing `style.transform`; no React state. ★ in the prototype. Cost: one rAF loop only while moving.

**11 Petal fall** (once per page, when a chosen section first scrolls into view) · nice · J/S
- A single petal (an SVG path with a hand-drawn irregular outline, not an ellipse) drifts down 180px over 9s along a sway path (`translateX` +-14px at a sine), rotates 25deg, fades in over the first 800ms and out over the last 1400ms; it never repeats unless the page is reloaded. Only one on screen. Metaphor: one petal letting go. Reduced motion: omitted. Touch: same. Impl: CSS keyframes with offset-path or three keyframes. Cost: negligible; value: charm, but careful (it must be the only one).

**12 Leaf shadow** (idle, ambient on paper) · nice · C
- Trigger: after 6s without input (class set by an idle timer) or constantly at very low opacity. Moves: a large blurred leaf-shaped shadow (SVG, `filter` baked into the image, not live) drifts left to right across the paper over 40s (`translateX(-20vw to 110vw)`), opacity 0 to 0.05 to 0, `multiply` at 4-6% ink. Under content, over paper only. Reduced motion: absent. Touch: same.
- Metaphor: a cloud/leaf shadow crossing a sheet. Impl: a fixed, `pointer-events:none` div under the page content, single CSS animation, `will-change: transform` for the animation's duration only. Cost: compositing one layer; must be tested for paint on big screens.

**13 Hover-lift of the print** (row thumbnails, small images) · maybe · C
- 2% scale + 4px rise on hover, never together with shadow. The law forbids shadow; skipped.

### Lists and navigation

**14 ★ Row hairline growth** (project/writing rows) · must · C
- Trigger: hover / focus-visible / press. Moves: the row's top hairline (1px) darkens `hairline` to `ink-faint` and an `accent` tendril of the same hairline grows from the left to 100% over 600ms; the title shifts `translateX(0 to 4px)` (<12px); the spec line fades `ink-muted` to `ink` over 400ms. Leaves in reverse.
- Reduced: color-only. Touch: `:active` and a pressed state held 120ms. Impl: pseudo-element on `.prow` with `scaleX` and `transform-origin:left`. Cost: free.

**15 Nav pill current-page bloom** (floating glass nav) · nice · C
- When the route changes, the new current item's label gains weight/accent through color only (240ms) and a 6px moss petal-shaped mark (not a dot) scales from 0.6 to 1 under it. Reduced: instant. Impl: CSS on `[aria-current]`. The existing glass owns its internals, so this is label-level only.

**16 Menu sheet unfold** · exists; keep as spec'd (sheet folds back into the pill).

**17 Scroll-linked header whisper** (name header) · maybe · C
- As the user scrolls away from the hero, the name's tracking tightens from -0.035em to -0.045em and opacity 1 to 0.6 across the first 200px (scroll-driven `animation-timeline: scroll()`), returning on scroll up. Barely perceptible; probably noise. Cut candidate.

### Route, loading, first load

**18 Route settle** (page transitions) · must · C
- Keep: content fades up 8px / 600ms. Add the View Transitions API (`@view-transition { navigation: auto }`) as progressive enhancement so the shared name/header persists while the body cross-fades 400ms. Reduced: instant. Impl: CSS only in Chromium/Safari 18.2+. Risk: Next 15 client navigations need `experimental.viewTransition`; check before committing.

**19 First-load paper** (first visit) · must · C
- Sequence, once per session: background paper grain present at once (no flash), then name settles (item 2) at 120ms, intro paragraph fades at 700ms (opacity only), photography arrives at 1100ms (item 9), nav pill fades at 1400ms. Nothing animates after 3s. Reduced: all appear at once with a 150ms fade. Metaphor: a table being set. Impl: CSS delays with a `--t` custom property; use `sessionStorage` flag to skip on subsequent routes.

**20 Skeleton as paper** (loading states) · nice · C
- Placeholders are a flat `paper-sunk` rectangle with a 1px hairline; no shimmer. A very slow 3s opacity breath between 1 and 0.7 only if loading takes over 800ms. Reduced: static. Impl: CSS.

### Cursor, idle, touch

**21 Dew cursor** (desktop pointer only) · maybe · J
- The pointer leaves the faintest 14px blob (an irregular drop shape, not a circle) that appears at 0 and fades over 900ms, spawned at most every 120ms and capped at 3 live. White-ish 10% with a 1px lighter rim. No custom cursor replaces the system one. Touch: none (replaced by the ink-soak on press). Reduced: none. Cost: moderate rAF; value: personality but a risk of gimmick. First to cut if the site feels busy.

**22 Press ripple, touch** · part of item 6; no separate effect.

**23 Rubber-banded lightbox drag** · exists; keep (spring + `project`).

**24 Idle breath** (name header after 20s of inactivity) · maybe · C
- Name `letter-spacing` oscillates -0.035em to -0.033em over 12s `ease-in-out`, one cycle only. Imperceptible; noted only because the research showed sites using 12-25s ambient loops (Arhøj). Cut candidate.

### 404 and edge states

**25 404 pressed leaf** · nice · S
- A single botanical sprig (illustration, tendril-drawn with `stroke-dashoffset` over 2.4s `--ease-out-soft`, 1px stroke in `ink-faint`) next to the line "this page wandered off". Reduced: drawn statically. Impl: SVG path `pathLength=1`, CSS dash animation. Cost: one SVG.

### Footer

**26 Footer settle** (footer mark + links) · nice · C
- The halmic mark fades in 1400ms when the footer enters; links use item 1. No parallax. Reduced: static.

### Articles

**27 Heading anchor tendril** (article headings) · nice · C
- Hovering a heading grows a small 14px stroke (a curled tendril SVG, not `#`) to the left of the heading, 420ms; click copies the link and the stroke turns `accent` for 1.2s ("copied" is conveyed visually and via `aria-live` text, not a toast). Touch: shown at 40% opacity always on `hover:none` devices. Impl: SVG + CSS, 8 lines JS for clipboard.

### Audio / haptics

**28 Haptic tick on lightbox settle** (iOS Safari 17.4+ via `<input type=checkbox switch>` hack or `navigator.vibrate` on Android) · maybe · S
- One 10ms light tap when the lightbox image lands on its thumbnail rect. No sound anywhere on the site (sound was found on none of the researched sites that we want to imitate, and the presence-without-announcement principle argues against it). Cut candidate.

---

## First ten (the signature set)

Chosen so that each part of the page has exactly one voice and no two effects compete:

1. **Tendril underline** (links)
2. **Settling title** (name and headings)
3. **Slow arrival** (photographs)
4. **Breathing edge** (photographs, hover)
5. **Blossom lean** (hero blossoms)
6. **Ink-soak press** (buttons)
7. **Row hairline growth** (index rows)
8. **Leaf shadow** (idle ambient)
9. **Petal fall** (once per page)
10. **Footnote dew** (targets)

Together: text answers hover with a growing line, images arrive and breathe, flowers lean, buttons soak ink, rows draw a vine, and the paper has weather. Items 5 and 9 and 8 are the only "decorative" ones; each fires rarely or very slowly.

## What we would cut first

Dew cursor (21), idle breath (24), scroll-linked header whisper (17), haptics (28), variable-weight lean (5): they add personality at the cost of "is something always moving?". Leaf shadow (12) and petal fall (11) are the most easily overdone: if both together read as busy, keep the petal and drop the shadow.
