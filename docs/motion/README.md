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
