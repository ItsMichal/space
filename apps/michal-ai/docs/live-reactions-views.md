# Article reactions and views

A row at the end of every article: five preset reactions with counts, and a quiet "N views" beside them. Nothing else
from the live backend is on the site (the globe has no emoji or presence; `PRESENCE_PINS` stays off).

## What is on, what is off

| Thing | Switch | State after this change |
| --- | --- | --- |
| Reaction row + views (client) | `LIVE_REACTIONS_ENABLED` in `lib/presence/flag.ts` | **true** (was false) |
| View counting (server) | on whenever the API is on | on |
| Show the view number | Worker var `VIEWS_PUBLIC` | `"1"` (public). `"0"` hides the number, counting continues |
| Emergency off | Worker var `LIVE_KILL` | `"0"`. `"1"`: every `/api/live/*` answers 204, the row disappears, no errors |
| Paragraph reactions | `LIVE_BLOCK_REACTIONS` in `flag.ts` **and** Worker var `LIVE_BLOCK_REACTIONS=1` | off (built, not shown; the server refuses block targets) |
| Presence pins on the globe | `PRESENCE_PINS` | off |

Committed config: `wrangler.jsonc` now has `"vars": { "LIVE_KILL": "0", "VIEWS_PUBLIC": "1" }`. Before this change neither
var was declared anywhere in the repo (`LIVE_KILL` was only read by the Worker, so the API was on as far as the Worker went;
the pages were what kept it dark, through `LIVE_REACTIONS_ENABLED = false`). Vars set in `wrangler.jsonc` win over the
dashboard on every deploy, so to pull the emergency switch either commit `"LIVE_KILL": "1"` and deploy, or run
`npx wrangler deploy --var LIVE_KILL:1` from `apps/michal-ai`.

## Reactions

Preset (already defined in the backend, `REACTIONS` in `lib/presence/constants.ts`): 👏 Applause, ❤️ Love, 🔥 Fire,
🤯 Mind blown, 🌱 Sprout. One tap toggles the visitor's own reaction; the count and pressed state change immediately
(optimistic), and roll back if the write fails. Counts load when the row is within 400px of the viewport, into space that is
already reserved (48px row), so nothing shifts. No account.

## Views

A view is one visitor, one post, one UTC day. The browser waits until the page has been visible for 5 seconds in total,
then sends `POST /api/live/views {id, vid}` (`fetch` with `keepalive`). It does nothing for automation
(`navigator.webdriver`), prerender, a tab that was never visible, or a post already counted today (`localStorage` key
`live.v.<id>`).

The Worker answers 204 to every well-formed view and counts it only if all of these hold, so a client cannot probe the rules:
canonical host (`michal.ai`; previews, `*.workers.dev` and local development are never counted; override with
`LIVE_CANONICAL_HOST` for local testing), not a bot user agent or empty one, no `Sec-Purpose`/`Purpose: prefetch|prerender`,
`Sec-Fetch-Dest` is `empty` (a script request, not a navigation), the visitor id was not already counted today, and the rate
limits below pass. HEAD and GET are 405.

## Identity and privacy

- No cookies, no fingerprinting, no IP address and no user agent stored.
- The visitor id is 15 random bytes made in the browser and kept in `localStorage` (`live.sid`). It is stored in the post's
  Durable Object only as the reaction row key (needed to toggle) and, for views, in `vseen(day, vid)`: rows for earlier
  days are deleted on the next write, so a visitor id is kept for the current UTC day only. Clearing site data or using
  another browser counts as a new visitor; that is inherent without accounts.
- Rate limiting uses a salted SHA-256 of the IP, rotating daily (`LIVE_SALT` optional), held in memory only.
- Same-origin only: no CORS headers, `Origin` must match, `Sec-Fetch-Site` must be `same-origin`, JSON only, bodies capped
  at 512 bytes, strict key validation.
- Ids are checked against `lib/presence/slugs.generated.ts` (built from `content/posts` by `scripts/build-live-slugs.mjs`),
  so arbitrary keys cannot create objects.

## Keys: stable post ids

Everything is keyed by the post's frontmatter `id`, not its slug, so renaming a slug or moving a post keeps its counts.
Every post now has `id:` (set to its slug at the time). Never change an id. New posts made in the writing tool get
`id: <slug>`. A test fails if a published post has no `id` or two share one; the build script falls back to the slug only as a
safety net.

## Storage

One `ReactionsRoom` Durable Object (SQLite) per post id, as before: a busy post cannot slow another, caps apply per post, and
unread posts cost nothing. Tables: `r` (reaction rows), `c` (counts; `('~','total')` reaction rows, `('~','views')` views),
`vseen` (visitors counted today, new), `meta` (schema version, new).

Schema migrations are in `worker/reactions-schema.ts` as an append-only list (v1 = `r`, `c`; v2 = `vseen`) applied on room
start, so a room created before this change simply gains the new table. wrangler's own `migrations` (v1 `PresenceRoom`,
v2 `ReactionsRoom`) register classes only and are untouched: no class was added, so no new wrangler tag. Add the next schema
version by appending to `MIGRATIONS`; never edit a shipped one.

Reads: `GET /api/live/reactions?id=` is cached at the edge for 30 s (stale-while-revalidate 60 s) and purged in that
location when a write changes it. The pages stay static; the row is client-rendered.

Limits: per client (salted IP hash) 30 reaction writes/min and 20 view writes/min at the Worker and again inside the
object; per post 600 reaction writes/min and 300 view writes/min; 20 writes/min per visitor id; 50,000 reaction rows and
20,000 remembered visitors per day per post; 1,500 writes/min across the Worker (per isolate, approximate). A Cloudflare WAF
rate rule on `/api/live/*` is still recommended.

## Reading the totals

There is no admin route and no auth was invented. The public read endpoint is the source:

```
node apps/michal-ai/scripts/live-totals.mjs            # https://michal.ai
node apps/michal-ai/scripts/live-totals.mjs http://localhost:8787
```

prints `[{ id, views, reactions, reactionsTotal }]` for every post, sorted by views. If you set `VIEWS_PUBLIC` to `"0"`,
views are not in that response; read them in the Cloudflare dashboard (Durable Objects, `ReactionsRoom`, SQL console on the
object for the post id: `select n from c where target = '~' and emoji = 'views'`).

## When it is unavailable

API down, `LIVE_KILL=1` (204), offline, an extension blocking the request, JavaScript disabled: the row never appears and
the article is unaffected. The client never throws; a failed write rolls the button back.

## Privacy note on the site

No privacy page, colophon or footer note exists on the site (the footer has links and the copyright line only), so no text
was added. This document is the record. Suggested neutral sentence if you want one on a future about or colophon page:
"Articles count visits and reactions without cookies; nothing identifies a person."

## Tests

`lib/presence/__tests__/views.test.ts` (id validation, bots, dedupe, rate caps, toggle semantics, client scheduling),
`worker/live.test.ts` (router: kill switch, validation, gating, rate limits, caching), `worker/reactions-schema.test.ts`
(migrations), `components/presence/useReactions.test.ts` (optimistic toggle, rollback, hide on failure, blocked storage).
`npm run check:do` checks the bundle still exports both Durable Object classes.
