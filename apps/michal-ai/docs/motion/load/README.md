# Cold-load main-thread blocking (backdrop tooth, hero, glass)

Harness scenario `cold-load-*` (cold HTTP cache, 80 ms RTT / 6 Mbit), production build, cpu 4x, three alternating runs each (`load/`, `load-m/` mobile, `load-p/` project page; `before-N` is main, `after-N` this branch). Metric: `load.tbtMs` (total blocking time, sum of long-task time above 50 ms over the whole load) and the longest tasks, from the clean (probe-only) pass.

| config | page | total blocking time (median of runs) | longest task | dropped frames |
| --- | --- | --- | --- | --- |
| desktop 4x | home | 177 → 34 ms | 190 → 66-74 ms | 28 → 13 |
| desktop 4x | project | 219 → 77 ms | 193 → 92 ms | 28 → 17 |
| mobile 4x | home | 211 → 56 ms (one after-run outlier at 346 ms) | 194 → 71 ms | 27 → 17 |

What changed (look and behaviour unchanged):

- Backdrop paper tooth (`components/site/backdrop/tooth.worker.ts`, `engine.ts`): the 1024 x 1024 texture (seeded arithmetic, 140 ms at 4x) is made in a worker by the same `makeTooth()` function, so the bytes are identical, and uploaded when it arrives. The first backdrop draw (and its fade-in) waits for it, so the paper never appears without its grain and then gains it; the wait is capped at 1.5 s, and without Worker support the same function runs when the page is idle. Bake mode (screenshots) stays synchronous. Baking it into a committed PNG/WebP was not done: seeded noise is incompressible (about 1 MB lossless), a bigger cost than computing it off the main thread.
- Shader compile (`backdrop/engine.ts`, `glass/gl.ts`): per-shader `COMPILE_STATUS` reads that stalled until the driver finished are gone; the two backdrop programs are linked before either is queried so the driver can compile them together; errors still report the shader logs. (`KHR_parallel_shader_compile` is not needed for this: nothing is queried until link time.)
- Hero (`components/presence/HeroGlobe.tsx`): the satellite shell renderer (its own WebGL context and compile) is created in an idle callback (or when the satellites arrive, whichever is first), and the text halo mask (a per-glyph blurred canvas draw, about 70 ms at 4x) is built in an idle callback after fonts are ready.
- Not done: lazy hydration of below-the-fold components. Hydration is about 130 ms at 4x in one React pass and the remaining longest tasks are 55-75 ms; splitting it needs per-island lazy boundaries that must keep the server markup, which I did not take on without a measurable win to justify the risk.
