# Image blur-up fade; where the cold-load hydration time goes

Table: `table.md` (harness `cold-load-*`, shaped network 80 ms RTT / 6 Mbit, `before/` = main, `after/` = this branch). Frames: `*/desktop-x1/cold-load-project/contact.png`: before, the sharp image replaces its LQIP placeholder in one frame; after, it sharpens from a 10 px blur over 360 ms.

How it works: `Picture` marks images that have a placeholder (`data-lqip`); a tiny head script listens for `load` once on the document and marks an image `data-sharpen` only when its bytes arrived within the last 400 ms (a resource timing entry exists), so cached images and reduced motion are untouched. CSS animates `filter: blur()` only.

## Cold-load long tasks (175 to 198 ms at cpu 4x): CPU profile, desktop cpu 4x, cold cache, home page

Total script time about 1 s at 4x (about 250 ms at 1x). By script:

| ms | script | what |
| --- | --- | --- |
| 334 | `home-*.js` | hero canvas (`draw`, `resize`, init) |
| 285 | `root-*.js` | backdrop: a synchronous 1024 x 1024 CPU noise texture (`$t`, 142 ms alone) and its draw loop |
| 133 | `entry.client-*.js` | React hydration |
| 100 | `glassButtonStyle-*.js` | glass engine setup |

Hydration of the app's own components is about 130 ms at 4x; the long tasks are the hero canvas, the backdrop noise generation and the glass engine, all in areas this audit does not edit (see the hand-back report). Suggested there: generate the backdrop noise in a worker or ship it as a texture, and start the hero and glass engines from `requestIdleCallback`.
