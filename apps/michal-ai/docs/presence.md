# Hero globe, presence and article reactions

Two independent features, both dark by default (`lib/presence/flag.ts`):

| Feature | Flag | Default | Needs backend |
| --- | --- | --- | --- |
| `HeroGlobe` (decorative background globe) | none; the component is simply not placed yet | not placed | no |
| Globe dots (live visitors + Hawthorne) | `PRESENCE_PINS` | off | yes |
| Article reactions row + view count | `LIVE_REACTIONS_ENABLED` | **on** (see `docs/live-reactions-views.md`) | yes |
| Paragraph reactions | `LIVE_BLOCK_REACTIONS` (+ Worker var) | off | yes |

Kill switch for all `/api/live/*` routes: set the Worker var `LIVE_KILL=1` (every route answers 204, the client treats that as "off" and renders nothing).

## HeroGlobe

`components/presence/HeroGlobe.tsx`, placed in the homepage hero slot (`app/page.tsx`, `data-hero-slot="background"`) and nowhere else. Lab: `/presence` under `next dev` (`?mock=1`, `?pins=1`, `?full=1`).

- Look: the sphere has no fill or texture of its own. A fixed screen-space dot matrix (5 CSS px pitch under 420px wide, 6 above, snapped to whole device pixels so it never shimmers) samples an analytically rendered sphere at each cell centre. Land is a large round dot, ocean a pin-prick, lambert shading toward the upper left with a soft terminator, dots fade to nothing toward the limb and the canvas keeps a 6% margin, so there is no edge anywhere. The globe rotates underneath the stationary grid at 2.4 degrees/second. Dots are the hero's own ink colour (read from computed `color`), opacity 0.28 via `--hero-globe-opacity-slot`, so the tint cross-fade behind shows through. The only other colour is one green cell for Hawthorne, CA (33.9164 N, 118.3526 W). No scanlines, glow, curvature or flicker; the only "terminal" touch is a 14% per-cell alpha variation.
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

Unit tests: geo snapping/jitter, validation, rate limiter, reaction toggling, history capping/dedupe, block ids, slug drift (`lib/presence/__tests__/presence.test.ts`). Against `wrangler dev --local` (script outside the repo): reactions on/duplicate/off/second session counts 1,1,2,1; unknown slug 404, bad origin 403, no origin 403, bad emoji 400, bad type 415, oversize 413, bad JSON 400, wrong method 405, rate limit 429 after about 22 writes in a minute; presence with two sockets saw each other's join, emoji change and leave, the fourth socket from one IP got 429, a bad Origin got 403, a non-upgrade got 426. Not verified: two independent browser contexts with different locations (local `request.cf` is the dev machine's, always Hawthorne), kill switch (code path is a one-line early return, only reasoned), reduced-motion rendering in a real browser, hover and tap on paragraph reactions beyond a static look, a real deploy. The in-memory mock reaction store is unit tested; the SQLite store is only exercised by the curl script above.

Screenshots: `docs/presence-shots/desktop-1440.png`, `mobile-375.png` (device metrics emulation 375x812 at 3x), `globe-zoom.png` (3x). Ours-vs-reference crops: not produced; the reference sites could not be screenshotted in this environment (the browser pane cannot save images to files).

## My view of the globe

The calm dot globe reads clean and professional in the zoom crop, and the Hawthorne dot lands on the California coast. It is also generic: it looks like any point globe. It is deliberately not "sketched"; the earlier ink/hatch version had no professional precedent and was dropped on instruction. The poles show convergence streaks of graticule lines, the outline is a little heavier than the dots, and dot size does not shrink with foreshortening near the limb as much as a polished version would. Not yet compared against a studied reference.
