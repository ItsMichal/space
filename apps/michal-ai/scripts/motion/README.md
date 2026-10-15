# Motion audit harness

Frame-by-frame capture of every interaction on michal.ai, against a production build, in headless Chrome over CDP.

```
npm run build:michal                       # once; the harness serves build/client through the real Worker (wrangler dev)
npm run motion:audit                       # every scenario, desktop and mobile, cpu x1 and x4  (about an hour; not in CI)
npm run motion:audit -- --quick            # the subset marked `quick` in scenarios.mjs, one profile pair (see below)
npm run motion:audit -- --only home-to-project,menu-open --profile mobile --throttle 4
npm run motion:audit -- --build .cache/baseline/client --out docs/motion/before   # serve a saved copy of a build
npm run motion:audit -- --trace            # adds a third pass with a devtools.timeline trace (long tasks, layout, style cost)
```

Needs Google Chrome (or `CHROME=/path`). Chrome and `wrangler dev` bind local ports, so run it outside restricted sandboxes.
`MOTION_GPU=swiftshader` forces software GL (slow with the WebGL hero; the default uses the machine's GPU through Metal).
`MOTION_KEEP_FRAMES=1` also writes every screencast frame as a JPEG next to the report.

Profiles: `desktop` 1440x900 @2x mouse; `mobile` 375x812 @3x, touch, iPhone user agent. `--throttle` is the CDP CPU
throttling rate (`1,4` by default). Not in CI: a full run takes far more than 3 minutes; `--quick` with one scenario is about 1 minute.

## What is recorded

Each scenario runs in a fresh Chrome tab, in up to three passes, each from a freshly loaded and hydrated page:

| pass | records | used for |
| --- | --- | --- |
| `screencast` | `Page.startScreencast`, every compositor frame with its timestamp | contact sheet, first-visual-response latency, change window, flash and blank frames |
| `clean` | only the in-page probe (`probe.js`), nothing else competing for the machine | dropped frames (rAF gaps), long tasks, long animation frames, layout shift, tracked element motion |
| `trace` (`--trace`) | `Tracing` with `devtools.timeline` | main-thread breakdown (Layout, UpdateLayoutTree, Paint, FunctionCall), the longest tasks |

The probe is injected before the app runs. Per animation frame it stores the time, scroll offset, border box and opacity of the
scenario's tracked selectors, the number of running animations and the height of `#main`; it also keeps `layout-shift`,
`longtask`, `long-animation-frame`, paint and font observers and input timestamps (`event.timeStamp`).

## Metrics (report.json, summary.md)

- `responseMs`: input timestamp to the first screencast frame that differs from the idle frame (the first visual response).
- `motionMs`: first to last changed frame. `screencast.gapsMs`: spacing of changed frames in that window.
- `raf.dropped`: frames missing in the clean pass (a gap of 33 ms counts 1), `raf.max` the worst gap.
- `tracked.<selector>`: for the axis that moved most (x, y, w, h, opacity): range, frames, `reversals` (movement against the
  direction of travel), `stalls` (zero-step frames inside continuous motion), `jumps` (a single frame covering over 40% of the
  travel), `maxJerkPx`. `scrollY` and a pixel-change centroid are tracked the same way.
- `flash`: screencast frames whose mean luminance leaves the range between the first and last frame, whose content collapsed
  (std-dev of luminance a quarter of the median), or that are a one-frame blip; `blankDomFrames` counts frames where `#main`
  had collapsed while the final page is tall.
- `cls`: layout shift in the window. `longTasks`, `loaf`: main-thread blocking in the window.
- `load` (cold-load scenarios): FCP, LCP, whole-load CLS, font load times, resource timings.
- `verdict`: a short list of what tripped (`SLOW-RESPONSE`, `DROPPED n`, `FLASH`, `CLS`, `LONGTASK`, `REVERSAL`, `STALL`, `JUMP`).

Artifacts per scenario, under `<out>/<profile>-x<throttle>/<scenario>/`: `contact.png` (frames in a grid, each labelled with
time since input and the gap to the previous frame), `plot.png`/`plot.svg` (position, per-frame step and rAF frame time against time;
violet ticks are screencast frames, red bars rAF gaps over 25 ms), `report.json`.

## Caveats

- The probe reads geometry every frame, which costs a little; the screencast pass is for pictures and latency, the clean pass for
  frame cadence. Compare runs of the same pass on the same machine; do not compare absolute numbers across machines.
- Screencast timestamps are when the compositor produced a frame; real display latency adds up to one vsync.
- View transitions animate pseudo-elements that have no DOM geometry; for those the pixel-change centroid and the contact sheet are the evidence.
- Headless Chrome has no vsync pacing beyond 60 Hz, and CPU throttling slows the main thread only, not the GPU.

## Adding a scenario

Add an entry to `scenarios.mjs`: `name`, optional `quick` and `profiles`, and `run(ctx, pass)` that loads a page (`prep`),
prepares state, and returns `cap(ctx, pass, { tracked, act, settle })`. `ctx` has `click`, `tapAt`, `hover`, `press`, `scrollBy`,
`swipe`, `drag`, `mark('input')` (to time from a later input), `goto`, `evaluate`, emulation switches, `captureLoad` for cold loads.
