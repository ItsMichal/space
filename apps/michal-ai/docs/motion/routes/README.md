# Route transitions: before / after

Harness: `scripts/motion` (PR #66). `before/` is `origin/main` built, `after/` is this branch built; same machine, same Chrome.
`table.md` is `node scripts/motion/compare.mjs before after` (desktop 1440@2x cpu 1x and 4x, mobile 375x812@3x cpu 4x; "err" is a scenario
that did not complete in that run). `desktop-x1/*/contact.png` are the frame sheets (frames labelled with ms since input and the gap to the
previous frame), `plot.png` the position / step / frame-time plot.

## What was wrong and what changed

| finding | evidence | fix |
| --- | --- | --- |
| Scroll position was never reset or restored on client navigation (no `<ScrollRestoration />`): opening a project from the work grid left the page scrolled 835 px down, and back did not restore the home scroll. | scrollY probe: project page opened at 835, was 0 expected | `<ScrollRestoration />` in `app/root.tsx`; `html[data-route-jump]` makes the restore a jump even though `html` has `scroll-behavior: smooth` (otherwise the restore would animate) |
| The route-enter fade (`.page-enter`, 600 ms from opacity .01) restarted when `<html data-vt>` was removed at the end of a view transition, so the new page blanked and faded in again after the cross-fade. Also ran on first load, hiding server-rendered HTML for 600 ms. | nav-work-writing-about contact sheet before: page blank at +658 ms after the cross-fade finished | the fade now exists only for navigations that did not get a view transition (`html[data-fade]`, set in the commit), never on first load |
| Only card clicks to post pages were transitions; every other route change hard-cut to a blank page and faded up. Back/forward hacked `popstate`, and the transition's update callback waited on the network (rendering is paused for that whole wait). | frames: old page vanishes, blank, fade | React Router starts the transition after the loader data is in (`viewTransition` + `flushSync` navigate option, `lib/nav.tsx`); the old page stays live and clickable meanwhile. `CardTransitions` now only names the morphing parts (old side at the click, new side in a layout effect inside the commit). Back/forward keeps the popstate replay for every route, wait capped at 700 ms (was 2500) |
| The page cross-fade used two unrelated timings (180 ms out with ease-in, 380 ms in delayed 60 ms), but the snapshots blend with plus-lighter and only sum to one when they are exact complements; the nav pill also rose 8 px with the page on every route change. | washed mid-frames, nav moving | one 320 ms `cubic-bezier(.4,0,.2,1)` for old and new; the nav is its own view-transition group (`site-nav`) |
| `<route>.data` was revalidated on every navigation (`max-age=0`), so even an intent-prefetched navigation paid a round trip before it could start. | headers | `public/_headers`: `/*.data` `max-age=60, stale-while-revalidate=600` |

## Numbers (see table.md) and what did not improve

Mixed, and said plainly: the freeze at the moment a project page opens is the React commit of the destination plus Chrome capturing the
two page states for the transition (about 4 to 15 dropped frames in one gap of 100 to 200 ms at cpu 1x, up to 270 ms at 4x), and this PR does
not remove it; the morph itself is smooth (no stalls, monotone steps, see `desktop-x1/home-to-project/plot.png`). What changed measurably:
back is faster to first change (240 → 110 ms desktop), mobile menu navigation 212 → 119 ms, mobile log prev/next 278 → 108 ms, reduced-motion
route dropped frames 5 → 0 at cpu 4x, no blank frame after a cross-fade, scroll positions correct. First response got later on some desktop
routes (nav 288 → 318 ms, theme 39 → 73 ms) because the old page now stays up until the destination's data is ready instead of freezing
at the click; against the 100 ms target these are loader-fetch time on `wrangler dev`, which prefetch and the new `.data` caching target on
production. Next candidates, not done here: render cost of the project page commit (markdown to React on every client navigation), and
the Chrome capture cost of the fixed glass nav and WebGL layers during the transition.
