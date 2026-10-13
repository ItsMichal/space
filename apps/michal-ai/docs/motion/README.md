# Motion craft

- `sources.md`: scouted handcrafted-animation sources and tools, with licenses and a top 12.
- `craft.md`: the standard ("No simple shapes, no simple tweens"): checklist, rules with before/after, performance, reduced motion, tool decision table.
- Toolkit: `lib/motion/` (pure maths, tested in `lib/motion/__tests__/`) and `components/motion/` (React).
- Live proof: `npx next dev`, then `/motion` (dev-only, `app/motion/page.dev.tsx`): six moments, simple beside crafted.
- Petal texture: `node scripts/build-petal.mjs` cuts `public/motion/petal.png` from `assets-src/botanical/own/cherry-blossom.jpg`.

## Toolkit API

| Export | From | What |
| --- | --- | --- |
| `makeStroke(points, {size, seed, wobble, tip, startWidth})` returns `{pts, d(from,to,bump), at(u)}` | `lib/motion/handStroke` | variable-width pen stroke outline, both ends movable |
| `catmullRom`, `resample`, `wobble`, `strokeOutline`, `polygonToSmoothPath`, `pointAt` | same | stroke building blocks |
| `linearSpring({response, damping})` returns `{easing, duration, samples}`; `sampledLinear(fn, n)` | `lib/motion/linearSpring` | CSS `linear()` spring easings |
| `createChain(root, opts)` returns `{pos, step(dt,t), pin, impulse}` | `lib/motion/springChain` | Verlet stem with phase-delayed wind |
| `blob`, `alignClosed`, `morph`, `closedPath`, `resampleClosed` | `lib/motion/pathMorph` | no-pop organic morph |
| `settleLine(i, opts)`, `settleTotal` | `lib/motion/settle` | per-line settle parameters |
| `createPetal`, `stepPetal`, `petalScaleX` | `lib/motion/petalPhysics` | plate-in-air petal physics |
| `useSpringSet(initial, configs, onFrame)` | `lib/motion/useSpringSet` | many springs, one rAF loop, DOM writes |
| `mulberry32`, `hash01`, `noise1`, `fbm1` | `lib/motion/rng` | seeded randomness and noise |
| `TendrilLink`, `InkPress`, `BuddingTimeline`, `StretchPill`, `SettleText`, `DriftingPetal` | `components/motion/*` | the six crafted moments |

## Card to page transitions (2026-10-13)

Opening a project or article card morphs it into the page, the way the App Store "Today" card opens. Files:
`components/site/CardTransitions.tsx` (wiring, mounted once in `app/layout.tsx`), `components/site/cardTransition.ts` (pure
helpers, tested in `components/site/__tests__/cardTransition.test.ts`), `app/styles/transition.css` (timing and pseudo-element styling).

- API: `document.startViewTransition`, not React's `<ViewTransition>` or `experimental.viewTransition` (Next 15.5 here, where the
  flag is experimental). One capture-phase click listener catches every link to a post path (`/projects/x`, `/projects/x/y`,
  `/writing/x`); it prevents the default, which `next/link` respects, and runs the same `router.push` inside the transition, so
  prefetching, scroll and focus handling stay Next's.
- Names are never in CSS (a `view-transition-name` must be unique per document). The clicked card's image, title and the card
  itself get `post-img`, `post-title`, `post-surface` just in time; the destination page's `.hero__img`, `.reading__head h1`
  and `.reading__surface` get them when the route commits; all are removed when the transition finishes. A card without an
  image names title and surface only.
- Cards covered (`CARD_KINDS`): home and `/projects` tiles, `/projects` rows, `/writing` rows and cards, entries and prev/next
  at the foot of a page, series prev/next, and the hover preview card (`.pv-in`). An in-text preview link has no card, so it
  gets the plain page cross-fade and rise.
- Back/forward: `popstate` is held back in the capture phase, the transition starts, and the same event is replayed inside the
  transition's update callback. Without this Next can commit the new route before the browser has captured the old page, and
  the old side is already the new page. The card we came from is named on the list page if it is on screen; scroll
  restoration is Next's.
- Do not wait on `requestAnimationFrame` inside the update callback: frames are paused until it resolves.
- Motion: groups 420ms on the nav fold's sampled critically damped curve; the rest of the page fades out in 180ms and in over
  380ms with an 8px rise. `html[data-vt]` turns the route-enter fade off while a transition runs (it would hide the new page
  when captured).
- Fallbacks: no `startViewTransition`, or `prefers-reduced-motion: reduce`: nothing is intercepted. `@view-transition { navigation: auto }`
  (motion allowed only) cross-fades hard navigations where cross-document transitions exist.
