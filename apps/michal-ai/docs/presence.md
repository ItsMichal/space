# Hero globe, presence and article reactions

Two independent features, both dark by default (`lib/presence/flag.ts`):

| Feature | Flag | Default | Needs backend |
| --- | --- | --- | --- |
| `HeroGlobe` (decorative background globe) | none; the component is simply not placed yet | not placed | no |
| Globe dots (live visitors) | `PRESENCE_PINS` | off | yes |
| Article reactions row + view count | `LIVE_REACTIONS_ENABLED` | **on** (see `docs/live-reactions-views.md`) | yes |
| Paragraph reactions | `LIVE_BLOCK_REACTIONS` (+ Worker var) | off | yes |

Kill switch for all `/api/live/*` routes: set the Worker var `LIVE_KILL=1` (every route answers 204, the client treats that as "off" and renders nothing).

## HeroGlobe

`components/presence/HeroGlobe.tsx`, placed in the homepage hero slot (`app/page.tsx`, `data-hero-slot="background"`) and nowhere else. Lab: `/presence` under `next dev` (`?mock=1`, `?pins=1`, `?full=1`).

- Look: the sphere has no fill or texture of its own. A fixed screen-space dot matrix (5 CSS px pitch under 420px wide, 6 above, snapped to whole device pixels so it never shimmers) samples an analytically rendered sphere at each cell centre. Land is a large round dot, ocean a pin-prick, lambert shading toward the upper left with a soft terminator, dots fade to nothing toward the limb and the canvas keeps a 6% margin, so there is no edge anywhere. The globe rotates underneath the stationary grid at 2.4 degrees/second. Dots are the hero's own ink colour (read from computed `color`), opacity 0.28 via `--hero-globe-opacity-slot`, so the tint cross-fade behind shows through. There is no other colour. No scanlines, glow, curvature or flicker; the only "terminal" touch is a 14% per-cell alpha variation.
- Placement (`slot` variant, default): hidden below 768px (at 375px the name block, tagline, rotating line and card row fill the hero, so there is no free area; this is a decision, change the media query to show it). From 768px: `width:min(34vw,420px); right:3vw; top:96px`, so it ends about 516px down, above the first card row (about 596px at 1440), and is never clipped by the slot or the next section. Checked at 768, 1024 and 1440 in headless Chrome; 1920 uses the same 420px cap; 375 hides it. Not checked: the shortest/tallest hero heights and a two-line rotating line beyond the 768 shot (it wraps there and does not touch the globe).
- Other variants: `bleed` (runs off the right/top edge; the parent must clip) and `full` (fills the parent as a square). Not used on the homepage.
- Non-interactive: `pointer-events:none`, `aria-hidden`, nothing focusable. Draws only within 120px of the viewport with the tab visible; DPR cap 2; `prefers-reduced-motion` draws one frame. Without WebGL2 (and before it is ready) a PNG of the shader's own output shows (`public/globe/fallback.png`, 26 KB, regenerate with `node scripts/capture-globe-still.mjs` against `next dev`).
- Contrast (measured on rendered pixels): the darkest dot pixel is rgb(178,174,155). Against it the tagline colour `#525c4f` is 3.14:1 and the ink `#18211b` text (name, rotating line) is 7.41:1. The tagline therefore would not reach 4.5:1 if it sat on the densest dots; at every width checked (768, 1024, 1440) the globe does not overlap the tagline or the rotating line, only, at 768, the tail of the name (large ink text, 7.41:1). A longer rotating line could reach the globe at 768 to 1024; it is ink, so it passes.
- Weight: land data `public/globe/land.bin` 10.5 KB (5.9 KB gz) fetched lazily, globe JS about 3 KB gz. Data: Natural Earth 110m land, public domain, via `world-atlas@2.0.2` (ISC), baked by `node scripts/build-globe-assets.mjs` (outputs committed; `world-atlas` and `topojson-client` are dev dependencies). Credit Natural Earth (naturalearthdata.com).
- Network with both flags off: two static GETs (`/globe/land.bin`, `/globe/fallback.png`). No `/api/live/*` request is ever made (the presence client is not created unless `PRESENCE_PINS`; reactions render only behind `LIVE_REACTIONS_ENABLED`).
- Props: `variant?: 'slot'|'bleed'|'full'`, `pins?` (default `PRESENCE_PINS`; live visitors as 5px ink dots), `mock?`, `className`.

### Precedent table (owner rule: every visual element needs a live professional example)

I could open only some references; the rest are named but not studied, and I say so.

| Element | Reference | Studied | What it follows |
| --- | --- | --- | --- |
| Screen-space dot-matrix / halftone globe (current) | GitHub's and Stripe's point globes (github.com/features had a globe; stripe.com/global) | No. github.com homepage today has no globe; stripe.com was declined in the browser pane. I did not study either, so this is from memory of the style, not a measured match | I could not open a live dot-matrix or dithered-WebGL globe on a professional site in this environment, so there is no studied precedent; the style is from memory of point/halftone globes. Pitch, radii and speed are mine, tuned by eye |
| "Ink-drawn, wobbly" globe (earlier attempt) | none found | n/a | Dropped. Replaced by the dot globe above |
| Reaction pills (bar) | github.com/facebook/react/issues/13991 (GitHub reaction buttons) | Yes, measured with DevTools | 1px border, fully rounded pill, 4px gap, 12px text there (14px here), 80ms `cubic-bezier(0.65,0,0.35,1)` transitions, no bounce. Difference: 44px height here (touch target) vs 28px there |
| Reaction count placement and action bar | medium.com article (karpathy.medium.com/software-2-0-...) | Partly: counts only, 32px bar, icon + number, no border | Icon-then-count, quiet. Paragraph-level margin affordance on Medium could not be inspected (page did not expose it) |
| Paragraph reaction popover | Medium/Notion/Readwise inline toolbars | No | Small solid paper popover with hairline border and 10px radius; no glass, no bounce (150ms fade). Unverified against a live example |
| Cards/radii | Apple | No. Site radius tokens used instead (`--radius-md` for controls) | n/a |

Honest status: the globe and paragraph popover are NOT backed by a studied live example. Before shipping either, open the references above and compare.

## Backend (Worker + Durable Objects)

Routes (`worker/live.ts`, handled before OpenNext; same-origin; no CORS headers):

- `GET /api/live/presence` WebSocket (426 without upgrade; Origin allowlist: request host, michal.ai, workers.dev, localhost).
- `GET /api/live/reactions?slug=` totals (edge cache `s-maxage=10`), `POST /api/live/reactions` toggle `{slug,target,emoji,sid,on}`.

`PresenceRoom` (one global instance, WebSocket Hibernation API): live sessions only in socket attachments; broadcasts coalesced to one message per 300 ms; ping/pong answered by the runtime; alarm sweeps sockets silent for 90 s or that never said hello within 15 s; caps 150 live, 4 sockets per salted IP hash, 12 msgs/10 s/socket. History (last 200 visits or 30 days) in DO storage as `{lat, lon, city, country, emoji, day}` with no session id; one entry per session per day via a per-day set of salted hashes that is dropped at midnight.

`ReactionsRoom` (one per post slug, SQLite storage): `r(target,sid,emoji)` rows and `c(target,emoji,n)` counts updated in one transaction. One of each emoji per session per target, idempotent set semantics, caps 50,000 rows and 400 distinct blocks per post. Slugs must be in `lib/presence/slugs.generated.ts` (written by `prebuild`, a unit test fails if it drifts), so unknown slugs never create objects.

Rate limits: per-isolate IP-hash limits in the Worker (20 connects/min, 120 reads/min, 30 writes/min, 1500 global writes/min) plus exact per-object limits (30 writes/min, 20/min per session id). These are approximate across isolates; a Cloudflare WAF rate rule on `/api/live/*` is recommended and is not configured here.

### Privacy as implemented

- Location comes only from `request.cf`. It is snapped to a 0.5 degree grid (about 55 km) in the Worker; the room adds deterministic jitter (up to 0.22 degrees) keyed by a random per-connection id, so pins in one city spread out and nothing finer than the grid is recoverable. Only city, region, country and the snapped+jittered point are stored or sent.
- IP addresses are never stored or broadcast. A salted SHA-256 (`LIVE_SALT` secret optional, daily-rotating) is used for rate limiting and the per-IP socket cap, kept in memory and socket attachments only.
- No cookies. The session id is random, kept in `sessionStorage` (reactions: also `live.mine.<slug>` there). Reactions store that id (needed for toggling) but no IP or location. No analytics, no fingerprinting. Automated browsers (`navigator.webdriver`) never open sockets or write.
- Trade-off: a different tab or a new browser session can react again (counts are per session id, not per person). That is inherent without accounts or cookies.

### The `PresenceRoom` export warning

Cause: not a missing export. The warning ("A DurableObjectNamespace in the config referenced the class PresenceRoom, but no such Durable Object class is exported from the worker") is printed by workerd when `getPlatformProxy()` starts. `opennextjs-cloudflare deploy` calls it (to read env vars) before running `wrangler deploy`, and `next dev` does too (`initOpenNextCloudflareForDev`). The proxy runtime never loads `worker/index.ts`, so every DO class looks absent. I reproduced the exact message with a bare `getPlatformProxy()` call, and `wrangler deploy --dry-run` shows the bundle `export { BucketCachePurge, DOQueueHandler, DOShardedTagCache, PresenceRoom, default }`: the deployed worker does export it (the deployed entry is `worker/index.ts` from `wrangler.jsonc` `main`, not `.open-next/worker.js`). It is harmless noise and cannot be silenced from config. `scripts/check-do-exports.mjs` asserts the dry-run bundle exports every class named in `wrangler.jsonc`, so a real regression fails.

Migrations: `v1` `new_sqlite_classes: [PresenceRoom]` (unchanged), `v2` `new_sqlite_classes: [ReactionsRoom]`. `wrangler deploy --dry-run` passes.

## Cost estimate (Workers Free: 100k requests/day, DO 100k requests/day and 13k GB-s/day, SQLite DO 5M rows read / 100k rows written per day)

Assumptions: each visitor loads one page with the globe pins on and connects for about 60 s; 3% react once; articles are read by half.

| | 100 visitors/day | 5,000 visitors/day |
| --- | --- | --- |
| Worker requests (probe + upgrade + reactions GET) | about 300 | about 15,000 |
| PresenceRoom requests (each message billed 1:20 for WebSockets) | about 1,000 | about 50,000 |
| PresenceRoom duration | hibernates between messages, about 0.1 GB-s | about 5 GB-s (broadcast flushes keep it awake 300 ms) |
| Storage writes (history + seen set) | about 200 rows | about 10,000 rows |
| ReactionsRoom rows written | about 10 | about 750 |

Free plan covers 100/day comfortably. At 5,000/day the PresenceRoom request count (about 50,000 billed) is the closest to the 100,000 limit; the realistic risk is a viral spike, in which case the per-DO 150-live cap and `LIVE_KILL=1` bound the cost. Pins are off by default, so none of this is incurred until `PRESENCE_PINS` is enabled. Numbers are estimates, not measurements.

## Strings added

UI (reactions only; the globe has no text): reaction labels "Applause", "Love", "Fire", "Mind blown", "Sprout"; group label "Reactions"; button labels "{label}, {n}"; "React to this passage"; "Reactions on this passage, {n}. Open". Visit-emoji labels in `lib/presence/constants.ts` (unused by the UI after the rescope): Sprout, Leaf, Tea, Moon, Sun, Butterfly, Autumn leaf, Book. Dev lab placeholder copy is not site copy.

## Emoji sets

Article reactions (5): 👏 ❤️ 🔥 🤯 🌱. Visit emoji (8, still accepted by the server but not shown anywhere): 🌱 🌿 ☕ 🌙 ☀️ 🦋 🍂 📖.

## Paragraph reactions

`rehypeBlockIds` (only when `LIVE_REACTIONS_ENABLED`) adds `data-block` to paragraphs of 24+ characters and h2-h4. Id = 5 base36 characters of a hash of the normalised first 240 characters, plus `-N` for repeats. Trade-off documented in `lib/presence/blocks.ts`: ids follow the text, so inserting, removing or reordering other paragraphs keeps reactions in place, while editing the opening of a paragraph orphans its reactions; a position index would move reactions onto the wrong paragraph instead. Desktop: hover reveals a margin mark; touch: tap the gutter right of a paragraph (no long-press, so selection is untouched). Keyboard: only the end-of-article bar is reachable; paragraph reactions are pointer-only (known gap).

Insertion point: one marked line in `components/content/PostPage.tsx` `after` block, behind `LIVE_REACTIONS_ENABLED`.

## Verification run

Unit tests: geo snapping/jitter, validation, rate limiter, reaction toggling, history capping/dedupe, block ids, slug drift (`lib/presence/__tests__/presence.test.ts`). Against `wrangler dev --local` (script outside the repo): reactions on/duplicate/off/second session counts 1,1,2,1; unknown slug 404, bad origin 403, no origin 403, bad emoji 400, bad type 415, oversize 413, bad JSON 400, wrong method 405, rate limit 429 after about 22 writes in a minute; presence with two sockets saw each other's join, emoji change and leave, the fourth socket from one IP got 429, a bad Origin got 403, a non-upgrade got 426. Not verified: two independent browser contexts with different locations (local `request.cf` is the dev machine's), kill switch (code path is a one-line early return, only reasoned), reduced-motion rendering in a real browser, hover and tap on paragraph reactions beyond a static look, a real deploy. The in-memory mock reaction store is unit tested; the SQLite store is only exercised by the curl script above.

Screenshots: `docs/presence-shots/desktop-1440.png`, `mobile-375.png` (device metrics emulation 375x812 at 3x), `globe-zoom.png` (3x). Ours-vs-reference crops: not produced; the reference sites could not be screenshotted in this environment (the browser pane cannot save images to files).

## Starlink on the globe (satellites, live cutout, pointer push)

What it shows: the Starlink constellation at its true current positions, drawn as small dots in the globe's own dot matrix. They move in real time (about 0.5 px/s on screen at 880px), so over a minute the constellation visibly drifts along-track relative to the land, which is the true motion.

Data flow:

1. Source: CelesTrak Supplemental GP for Starlink (`https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json`), derived from SpaceX public ephemerides. The regular `gp.php?GROUP=starlink` file was not needed (SupGP was usable). Credit line: footer and `public/media/CREDITS.md`.
2. Pack (`lib/starlink/orbit.mjs`, one ES module used by the Node build script, the Worker and the browser): per satellite five little-endian Float32 at a common reference epoch: inclination, RAAN, argument of latitude (argp + mean anomaly), its rate, and its drag rate. Header 20 bytes (magic `SLNK`, version, count, reference epoch as float64 unix seconds). About 11,100 satellites, 20 bytes each, 222 KB (gzip smaller). Objects outside 14.5 to 16.5 rev/day or with e >= 0.02 are skipped. Who each satellite is lives in a separate sidecar, `public/globe/starlink-ids.bin` (and `/globe/starlink-live-ids.bin` from the Worker), so the constellation file keeps exactly this layout for clients already cached: magic `SLID`, version, count and reference epoch equal to its constellation file, then 12 bytes per satellite in the same order (NORAD number, the number in its STARLINK-NNNN name with the top bit set for "[DTC]", launch as year*1000 + launch number from the COSPAR id). Readers pair the two only when count and epoch match. Only the character-cell hero fetches the sidecar.
3. Build time: `scripts/build-starlink.mjs` (in `prebuild`) refreshes `public/globe/starlink.bin` only when the committed snapshot's epoch is older than 12 h and the fetch works; any failure keeps the committed file. In CI (`process.env.CI`) it never fetches.
4. Runtime freshness: a Cron Trigger (`17 */6 * * *`, `triggers.crons` in `wrangler.jsonc`) calls `scheduled()` in `worker/index.ts`, which fetches CelesTrak, packs with the same module and stores the bytes in the existing `ReactionsRoom` SQLite Durable Object under the fixed name `~starlink` (a `blob` table, one row). No new binding, namespace, migration or token. `GET /globe/starlink-live.bin` (`worker/starlink.ts`, routed before OpenNext and outside `LIVE_KILL`) returns it with `Cache-Control: public, max-age=3600, s-maxage=21600`, or the static snapshot when the object is empty.
5. Client: after the globe is up, `globe/starlink.ts` tries `/globe/starlink-live.bin`, then `/globe/starlink.bin`. If the reference epoch is more than 30 days old (or in the future by more than a day) nothing is drawn. Satellites fade in over 1.6 s. The fallback PNG, reduced-motion still and no-WebGL paths never show satellites in the PNG; under reduced motion the GL globe draws them once at their current true positions.

Rate-limit rule: CelesTrak asks that a file is fetched at most once per 2 hours. The build script keeps the raw download in `.cache/` (git-ignored) and reuses it, and refuses to fetch when it is younger than 2 h; the cron runs every 6 h and skips when the stored copy is younger than 2 h; CI and local `next dev` never fetch.

Maths (mirrored in `positionEcef`, the vertex shader in `globe/renderer.ts` and tested against SGP4):

- Circular orbit, J2 secular drift. `a = (mu / udot^2)^(1/3)` (radius from the angular rate), `RAAN(t) = RAAN0 - 1.5 J2 (Re/a)^2 udot cos i (t - t0)`, `u(t) = u0 + udot (t - t0) + udd (t - t0)^2 / 2`. The packer converts TLE mean motion to the Brouwer mean motion (SGP4's un-Kozai step), uses SGP4's first-order secular rates for node, perigee and mean anomaly, and takes `udd` from MEAN_MOTION_DOT, then propagates each element from its own epoch to the common one.
- ECI to Earth-fixed: rotate by Greenwich sidereal time. For a circular orbit that is the same orbit with `RAAN' = RAAN - GMST`, so the shader only needs one extra uniform (`gmst`, computed per frame in JS from `Date.now()`).
- Earth-fixed `(x, y, z)` (x to lon 0, y to lon 90E, z north) maps to the globe frame `(y, z, x)` the land texture uses; then the same rotation and tilt as the land. The spin is applied to land and satellites together, so they stay in true relative position; only the decorative spin is not real.
- Scale: true. Orbit radius is each satellite's own `a / 6371 km`, about 1.086 globe radii. Points snap to the 6 px cell grid, radius 0.2 pitch, strength 0.6 of the ink alpha. Hidden behind the Earth when behind and inside the disc, 50% on the far side outside the disc, faded toward the canvas margin (shell points at 1.086 R would otherwise be clipped by the canvas edge at SPHERE_FRACTION 0.94). Canvases under 520 px draw every second satellite.
- Measured against satellite.js SGP4 (50 satellites spread over the shells, sub-point great-circle error, from the newest element epoch): +0 h max 0.14 deg, +1 h 0.15 deg, +24 h 0.12 deg, +72 h 0.84 deg (means 0.06 to 0.09 deg). The test bounds are 0.3, 0.3, 0.5 and 1.5 deg. Before the drag term the +72 h worst case was 24 deg (low, decaying satellites).

Live cutout: the dim box behind the rotating line is the stem plus the phrase on screen (not the union of all phrases). A MutationObserver on the rotator's `data-current` triggers a remeasure; the box eases from the old to the new rectangle over 480 ms with `cubic-bezier(0.22, 1, 0.36, 1)`, the phrase's own enter delay plus duration and curve. Dots shrink as well as fade over about four cells at the edge. Under reduced motion it snaps.

Pointer push: `window` `pointermove` only (the canvas stays `pointer-events: none`); `(hover: hover) and (pointer: fine)` and not reduced motion. Radius 100 px, maximum displacement 12 px, radial with a gaussian falloff, applied to land dots and satellites in the shader (land: the pixel's source cell is found by inverting the displacement; satellites: the snapped centre is displaced). Pointer position and strength are critically damped in the existing rAF loop; strength eases to 0 after 1.5 s idle or when the pointer leaves the globe box. With strength 0 the shader skips the push entirely. Dev only: `?ptr=fx,fy` pins the pointer (fractions of the globe box, y down) for screenshots; `window.__globe` exposes the state.

Not verified: behaviour on a real GPU (screenshots are software GL), a real Cron execution (needs a deploy), and the first CelesTrak fetch from a Worker (CelesTrak may rate-limit shared Cloudflare egress IPs; if so the Worker keeps the static snapshot).

## Text halo

- Text halo (replaces the dim rectangles): `HeroGlobe.measureText` draws every glyph of the name, tagline, "I've built", the phrase on screen and "Selected work" at its real position (Range rect per character, computed font) into an offscreen canvas at 1/4 of the canvas size, with a canvas `shadowBlur` halo of about 12 CSS px. That canvas is uploaded as a texture and the shader shrinks and fades land dots, satellites and trails by it, so the clearing follows the letter contours with no straight edges. It is rebuilt only on phrase change, resize and font load; the old and new textures cross-fade over 480 ms with the phrase's curve (no fade under reduced motion). Dev: `?spin=0&lon=-60` freezes the globe with dense land behind the text.
## The hero has no portrait

The owner's photo is not on the hero (a halftone, then a baked terminal-character version were tried and removed); it lives in the About page. The globe, shell, trails, pings, text halo and pointer push below are what the hero draws.

## Satellite shell, trails and mesh pings

- Altitude is EXAGGERATED for legibility; positions and motion are real. The real orbit radius (about 1.05 to 1.10 globe radii) is mapped onto a drawn shell of 1.34 to 1.58 globe radii (`SHELL` in `HeroGlobe.tsx`, `uShell` in the shader), ordered by each satellite's own altitude. The footer credit (positions from orbit data) stays accurate; altitude is not to scale.
- The canvas is 1.55 times the old globe box (`SHELL_SCALE`, CSS `--hg-k`), centred on the same point, so the sphere keeps its size and position and the shell is not clipped. Dots fade out before the canvas edge, and the hero slot's own overflow and bottom mask still apply. Satellites behind the disc are hidden; in front they are drawn over it. Depth: size and alpha scale from 0.7 to 1.2 and 0.4 to 1 with distance from the viewer.
- Trails: every satellite's path over the last 90 s (45 s on phones) is drawn as 10 one-pixel line segments from the same elements evaluated at t minus age (instanced, no CPU work), fading to the tail. Mesh pings: `lib/starlink/links.mjs` builds a neighbour table once when the elements load (in-plane ahead neighbours, nearest argument of latitude in the adjacent plane). Up to 20 pings (8 on phones) run at once, picked at random from links whose two ends are on the visible hemisphere, each a thin link with a travelling pulse and a round head over 0.6 to 1.2 s. The line ends are evaluated in the shader from the two satellites' elements, so they stay attached. Every third satellite is drawn on desktop, every fifth on phones. Reduced motion: no pings, but trails still show the path; the text halo applies to all of it.
- Not measured here: frame cost on a real GPU (software GL only), so there is no ms figure; the work per frame is about 4,000 points, 4,000 x 20 line vertices and 20 ping strips of 21 vertices.

## Hero polish pass (ripple, characters, longer trails, comet pings, fluid hover)

Tunables (constants at the top of `HeroGlobe.tsx` unless noted):
- Shell: `SHELL` 1.9 to 2.3 globe radii (was 1.34 to 1.58; exaggerated, positions real). `SHELL_SCALE` 2.2 (canvas is 2.2x the globe box; CSS `--hg-k`). Canvas cost grows with it (about 2,900 px square at 1440 @1.5x), so dots fade before the canvas edge.
- Trails: `trailFor` 300 s desktop, 180 s phones; 28 segments each; alpha `exp(-3.2 f) (1 - f)` at 0.34 of the old head alpha (renderer). Satellites with dots: every 2nd (desktop) / 4th (phones); trails on every 2nd of those.
- Pings: `pingsFor` 30 desktop, 12 phones; each hop 0.8 to 1.6 s, eased, soft comet (14 gaussian point sprites) plus a bloom on the receiver; 60% of pings chain 2 to 4 hops through the neighbour table (`adj`).
- iOS: `resize()` only reallocates the canvas when the pixel size changes, `apply` returns early when size and DPR are unchanged (toolbar show/hide), and a real resize redraws in the same task. The hero box is sized in `svh`, so it does not jump with the toolbar; the globe already pauses off screen (IntersectionObserver).


## Two canvases (review of the polish PR)

- The shell canvas is separate and low resolution: the globe canvas is the globe box at the device pixel ratio (cap 3 on phones, 1.5 on desktop) and holds the dot-matrix sphere; the shell canvas (`.hero-globe__shell`, `createRenderer(..., 'shell')`) is 3.2 times the box, centred on it, at most 1.25 device pixels per CSS pixel and capped at about 2.5 MP on desktop and 1.2 MP on phones (`shellDprFor`). It draws satellites, trails and pings. The text halo mask is built once in globe-box coordinates and sampled by both canvases (`uMaskScale`).
- Draw calls per frame: 1 on the globe canvas (land), 4 on the shell canvas (satellites, trails, ping comets). Two WebGL contexts instead of one (plus the backdrop's).
- Deterministic motion captures (dev server only): `?t=<s>` sets the materialise sweep and the ping clock (`window.__globe.devT`), `?pingdemo=1` fixes one ping and exposes its screen ends, and `scripts/capture-motion.mjs` steps them and writes frames.

## Production smoke test and start-up time

- `node scripts/hero-smoke.mjs <url> [--phone]` loads a BUILT site (`npm run build:michal` then `wrangler dev`, or a deployed URL) in headless Chrome with software GL, waits for `window.__hero()` (a non-enumerable, read-only snapshot that `HeroGlobe.tsx` defines in every build: frames drawn, satellites drawn, whether both contexts are alive, last GL error), listens for console errors and checks that the rotating phrase is visible. It exits non-zero if the globe fell back, the shell has no context, a context was lost, a GL error was raised, no satellites were drawn, the phrase is not visible, or the console printed an error. Run it after a build before shipping a change to the hero.
- Start-up is slow on software GL, not broken: in a production build under SwiftShader the first frame appears many seconds after navigation (shader compilation and two contexts; the canvases a role never uses are compiled as empty stand-ins to halve that). Wait for `window.__hero().readyMs > 0` before a screenshot. On a real GPU this takes a fraction of a second.

- Shell: satellites are drawn as `+` characters (size and strength by depth), at 2.6 to 3.1 globe radii (altitude exaggerated, positions real; canvas `SHELL_SCALE` 3.2, still capped at 2.5 MP desktop and 1.2 MP phone). Trails are five specks behind one in three drawn satellites over the last 90 s (60 s on phones), not lines. Pings: at most 10 at a time (4 on phones), a short dim comet of seven specks, no bloom.
- Alignment: `lib/starlink/__tests__/alignment.test.ts` checks that for any spin and tilt the globe-frame direction `(ecef.y, ecef.z, ecef.x) / r` of a satellite equals `toVec(sub-point)` (the mapping the land uses), so the shell turns rigidly with the globe.
- Text glow: the mask is a canvas `shadowBlur` of 26 px, two draws, sampled through a gentle smoothstep, so neighbouring letters merge into one cloud. Registration of the mask with the DOM text was measured: the canvas baseline equals the DOM baseline to the pixel for the name, tagline, stem and heading (zero difference at DPR 2), so no offset is introduced by the mask itself.

## My view of the globe

The calm dot globe reads clean and professional in the zoom crop, and It is also generic: it looks like any point globe. It is deliberately not "sketched"; the earlier ink/hatch version had no professional precedent and was dropped on instruction. The poles show convergence streaks of graticule lines, the outline is a little heavier than the dots, and dot size does not shrink with foreshortening near the limb as much as a polished version would. Not yet compared against a studied reference.

## Character-cell hero (`?hero=ascii`)

`components/presence/HeroAscii.tsx` draws the globe as monospace glyphs on one 2D canvas: land shaded through the ramp `.:-=+*#%`, ocean as a faint dot grid, satellites from the same Starlink pack propagated at the current time, a ground terminal joined to its highest satellites by glyph strands (Verlet, 14 points, 3 passes) that bend with a drag and spring back, and every 6 to 10 s one satellite pointed out with its name, NORAD number, launch, altitude, speed and inclination from the pack (nothing else is shown when a field is missing; provisional SupGP numbers above 99999 are left out). A tap or click on a satellite pins its label; elsewhere it moves the terminal. The label is placed away from the hero text, the nav bar, the terminal and the first card. One rAF loop at 32 fps, paused offscreen and in hidden tabs; the earth layer is cached and redrawn only when the spin crosses a mask column. Reduced motion draws one still frame with one label. Pure parts (glyphs, label text) are in `ascii/field.ts` with tests.

Toggle: `HERO_DEFAULT` in `lib/hero/flag.ts`, or `?hero=ascii` / `?hero=globe` per visit. `?callout=1` (dev only) pins the first label for screenshots. Shots in `docs/ascii-hero-shots/`.
