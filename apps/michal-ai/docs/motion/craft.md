# No simple shapes, no simple tweens

The standard every motion on this site must meet. It sits under the law in `docs/design-system/README.md` (incredibly subtle, tasteful, slow; paper and nature; no scroll-jacking) and adds the craft that makes subtle motion read as handmade instead of default. Toolkit: `lib/motion/**`, `components/motion/**`. Live comparison: run `next dev`, open `/motion` (simple on the left, crafted on the right).

The test in one sentence: **if you could build it with a `div`, a `border-radius` and `transition: all .3s ease`, it is not finished.**

## The checklist (every animated thing must pass all five)

1. **Two overlapping motions at least.** Something leads, something follows, on different timings (head and tail, line and blur, stem and leaf). One property tweening is a tween, not a gesture.
2. **An organic silhouette.** No perfect circles, bars or boxes for decorative things. A stroke has a pressure profile, a blob has seeded harmonics, a leaf is asymmetric. Controls (pills, 44px hit areas) keep clean geometry, but what moves inside them still follows rule 1.
3. **Asymmetric in and out.** Arrive differently from how you leave: draw on fast with a settle, soak away slowly; open on a springy overshoot, close critically damped and quicker.
4. **A physical reason.** Name it: ink wicking into fibre, a stem with mass, a plate-shaped petal catching air, a trailing edge dragged by surface tension. If you cannot name it, delete the motion.
5. **Interruptible with kept velocity.** Any state can reverse mid-flight from where it is, with the velocity it has (`createSpring().to()`, CSS transitions, `useSpringSet`). Never restart, never queue, never lock input.

Plus the always-on rules: reduced motion lands every change instantly with no transforms; touch is complete (nothing depends on hover; 44px targets; `touch-action: pan-y` on horizontal gestures so vertical scroll is never hijacked); 60fps measured on a throttled CPU, not assumed.

## How to be rich and still subtle and slow

- Richness comes from layered small things, not from big ones. Keep amplitudes small (max travel 12px, scale delta 2%, rotation under 1 degree for text) and let *timing and shape* carry the craft.
- Slow means 600ms to 1.4s for arrivals and 1.5s+ for ambient soaking. Fast is reserved for direct response to a finger (under 120ms of latency, 1:1 tracking).
- One thing leads at a time in a view; the rest follow it. Never two heroes.
- Overshoot is allowed only where the user imparted momentum or where a living thing lands (a bud, a pen). Cap it at about 6% and keep it under 20% of the duration.
- Randomness is seeded. The same click draws the same wobble. Nothing re-rolls mid-animation (`rng.ts`).

## Rules, with before and after

### 1. Lines are strokes, not boxes
Before: a 1px bar scaling in.
```css
.link::after{content:"";position:absolute;bottom:-2px;height:1px;width:100%;background:currentColor;
  transform:scaleX(0);transform-origin:left;transition:transform .3s ease}
.link:hover::after{transform:scaleX(1)}
```
After: one filled outline with width as a function of arclength, a landing blunt start, a tapering tip, a curl at the end, a head spring that overshoots (as extra pen pressure, not extra length) and a tail spring that wipes it off like soaking ink.
```tsx
<TendrilLink href="/work">Selected work</TendrilLink>
// internally
const stroke = makeStroke(controlPoints, { size: 3.2, seed, wobble: 1.9, tip: 0.1 })
path.setAttribute('d', stroke.d(tail, Math.min(1, head), Math.max(0, head - 1) * size * 5))
```
Why it passes: overlapping (head, tail, pressure), organic (wobble + taper + curl), asymmetric (draw 0.62s bouncy, leave 0.85s critical), physical (pen and ink), interruptible (re-hover turns the tail around).

### 2. Press is ink, not a scale
Before: `button:active{transform:scale(.97);background:var(--paper-sunk)}`.
After: `InkPress`. A blob blooms from the pointer on a 1s critically damped spring; its radius per angle comes from seeded fractal noise (irregular boundary) with a ragged high-frequency edge that grows with spread; its rim pools darker; paper fibre is subtracted from the body with a tiled streak texture; on release it keeps soaking outward with its current velocity while the alpha fades over 1.5s. Overlapping presses are separate blots with their own springs. The label moves 0px.

### 3. Progress grows, ticks bud
Before: a filled bar plus dots that go from 25% to 100% opacity.
After: `BuddingTimeline`: the stem is a hand stroke whose tip is a spring (follow-through behind the finger); each tick is a leaf that opens on an underdamped spring (overshoot then settle) when the head passes it; each leaf has a follower spring that lags the head by an amount that grows along the stem, so scrubbing sets leaves swaying a beat late. Different springs per leaf, driven by one rAF loop.

### 4. Indicators stretch, they do not slide
Before: `transform: translateX(var(--i))` on a circle.
After: `StretchPill`: two edge springs. The edge nearest the destination leads (fast, 0.36s, slight overshoot); the other trails (0.66s, near critical). Between them the pill elongates, its height drops to conserve area, and its middle pinches in. Direction flips which edge leads. A second tap mid-flight keeps both velocities.

### 5. Text settles per line and per property
Before: `opacity 0 to 1, translateY(12px) to 0` on the block.
After: `SettleText`: line by line with seeded stagger (about 110ms, jittered), per-property springs with different timings: opacity 0.34s critical, blur 0.62s critical (blur-to-sharp lingers after the text is readable), rise and a tilt of under 0.7 degrees on a 0.7s spring at damping 0.62. The reverse is faster and unstaggered. Any call retargets from current values. Text is real DOM text with `aria-label`; no JS means it simply shows.

### 6. Falling things are plates in air
Before: `translateY` linear, rotating at constant speed.
After: `stepPetal`: drag depends on how face-on the petal is (`cos^2 theta`), a lift term `sin 2theta` swings it sideways, the tumble `theta` is driven by sideways air flow, in-plane rotation follows velocity through a pendulum spring, and apparent width is `|cos theta|`. Texture is the owner's own petal (`public/motion/petal.png`, cut from `assets-src/botanical/own/cherry-blossom.jpg` by `scripts/build-petal.mjs`). Pointer stirs the air near it; a tap flicks it.

### 7. Stems are chains
Use `createChain` (position Verlet): pinned root, distance constraints, a soft upright rest pose, a wind with a per-node phase delay so a gust rolls up the stem. Phase offset is the trick; never sway every node with the same sine. Example (not wired on the site yet):
```ts
const stem = createChain({ x: 40, y: 200 }, { length: 120, nodes: 9, wind: 900, phase: 0.55 })
// in rAF: stem.step(dt, t); draw stem.pos through catmullRom and strokeOutline
// on scroll flick: stem.impulse(velocityX)
```

### 8. Shapes morph, they do not cross-fade
Use `alignClosed` then `morph(a, b, t)` (polar about the centroid) and `closedPath`. `t` may overshoot 0..1 from a spring for a living wobble. Blobs from `blob(seed, radius)`.

### 9. CSS state changes get a sampled spring
`linearSpring({ response: 0.5, damping: 0.72 })` returns `{ easing: 'linear(...)', duration }`. Use both together:
```css
.chip{transition:transform 890ms linear(0,0.05,...,1)}
```
Compositor-only, interruptible (CSS transitions retarget from the computed value). Prefer this over JS for anything that is just state A to state B.

## Performance rules
- Animate only `transform`, `opacity`, `filter` (small areas) and SVG `d` on small paths. One rAF loop per component, driven by springs, stopped when settled (`useSpringSet`, `isSettled`). Never React state at 60fps: write to refs/DOM.
- Paths stay under about 120 points; canvas stages are DPR-capped at 2 and stop when off-screen or the tab is hidden (`IntersectionObserver`, `visibilitychange`).
- No `filter: blur` on large areas, no `backdrop-filter` inside animated layers, no `will-change` left on after settling.
- Measure on a throttled CPU (DevTools CPU 4x) at 375px: p95 frame under 20ms is the bar. Results for the lab are in the PR report.

## Reduced motion
Spring `to()` lands instantly; `SettleText` shows text at once; `DriftingPetal` draws a resting petal; `InkPress` shows no bloom; CSS demos set `transition: none`. Opacity-only cross-fades remain allowed where state must be perceivable. Never replace motion with a different, louder motion.

## Which tool for what

| Need | Use | Cost | Notes |
| --- | --- | --- | --- |
| A->B state change on one or two properties | CSS transition + `linearSpring()` easing | 0 kB | default |
| Gesture-driven or retargeting values | `createSpring` / `useSpring` / `useSpringSet` | under 1 kB | already in repo |
| Pen strokes, underlines, stems | `makeStroke` / `strokeOutline` (HandStroke) | about 3 kB | ours; perfect-freehand-compatible idea |
| Organic shape morph | `lib/motion/pathMorph.ts` | about 2 kB | flubber only for arbitrary SVG path inputs |
| Stems, hair, follow-through chains | `createChain` | about 1.5 kB | Verlet; do not add Matter.js |
| Text arrival | `SettleText` | about 2 kB | do not add GSAP SplitText |
| Falling petals / pollen | `petalPhysics` + canvas | about 1.5 kB | cap particle count (under 12) |
| Scroll-linked reveals | CSS `animation-timeline: view()` (as in `globals.css`) | 0 | no scroll-jacking |
| Hand-keyed illustration with state machine (blossom opening) | Rive (MIT runtime, about 150 kB wasm) | heavy | only if the owner authors the file; lazy-load |
| One-off spot art from AE | dotLottie | heavy | lazy-load; Lottie Simple License verified |
| Complex hero timeline | GSAP (free; non-OSS license, Webflow may amend) | 25+ kB | last resort; check the license page at adoption |

Library rule: a new dependency needs a size, a license read on the repo, and a reason the toolkit cannot do it. MIT/Apache preferred; AGPL (Theatre Studio) is dev-time only.

## Review ritual before merging any motion
1. Record or step frames (5 to 6 across the motion). Does the middle frame look like a drawing, or like a state?
2. Interrupt it at 30%, 60% and 90% in both directions.
3. Tap it on a phone without hover.
4. Turn on reduced motion.
5. Throttle CPU 4x and watch the frame time.
