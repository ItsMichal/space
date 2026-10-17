# Opening a project page: what the freeze was made of

A CPU profile of the click-to-commit window (desktop, cpu 4x, home to a project page) on main showed the time was not in the destination's React render but in two pieces of work that ran inside the commit of the route change:

| ms at 4x | where | what |
| --- | --- | --- |
| 180 | `HeroGlobe` unmount | `WEBGL_lose_context.loseContext()` of the hero globe renderer, synchronous, when the home page unmounts |
| 111 | `useReading` (status pill in the nav) | on the destination page, `measure()` walks every block of the article (a layout read per element, plus word counts), and the ResizeObserver's first callback did it a second time |

Fixes (behaviour and look unchanged): the globe's WebGL contexts are released in an idle callback after the canvases are out of the document; the reading measurement runs once, when idle (the pill's progress appears a moment later, as it does on a hard load), and the observer's initial callback no longer repeats it.

`table.md`: before (`origin/main`) vs after, one run per cell (`before/`, `after/`). Desktop cpu 1x, where run-to-run noise is small:

| scenario | dropped frames | worst frame gap |
| --- | --- | --- |
| home to project | 17 → 3 | 233 → 67 ms |
| project back | 17 → 1 | 300 → 33 ms |

cpu 4x, three alternating runs (`../freeze2x`): home to project dropped frames median 21 → 19, worst gap 300-317 → 267-300 ms; back 19 → 15, 150-167 → 117-150 ms. At 4x the remaining freeze is the layout of the destination page (about 105 ms) plus React's commit and Chrome's capture of the two page states; this PR does not remove it. Not done: deferring the gallery, timeline, reactions and lightbox of the destination (they did not show in the profile), `content-visibility` on the prose (scroll-anchoring and layout-shift risk), and fewer named view-transition elements (only three are named, a small share).

First-response numbers in the tables vary by about 100 ms between identical runs and should not be compared at that scale.
