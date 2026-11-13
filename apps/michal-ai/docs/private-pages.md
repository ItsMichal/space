# Private pages

Link-only pages on michal.ai for one reader or a few (a future employer, say). Each page has one or more links,
`michal.ai/p/<token>`, ideally one per reader, so the stats say who opened what. A page is never listed, indexed, in the
sitemap, the feeds, search, JSON-LD or any card, and answers 404 once it is off, its link is revoked or the link has
expired.

## Where things live

| What | Where |
| --- | --- |
| The page files | `pages/<id>.md` in ItsMichal/space-content (private), pulled to `content/pages/` by `content:pull` (gitignored) |
| The rules | `lib/content/pages.mjs`: front matter schema, the post body rules, tokens unique across pages, `linkUntil`/`linkOpen` |
| Parse, write, tokens | `lib/pages/page.ts` (gray-matter, build and Worker of the editor), `lib/pages/text.ts` (no dependencies, browser too) |
| Build | `lib/pages/build.mjs`, `scripts/build-pages-manifest.mjs` (after `react-router build`), the `p/:key` route in `app/routes.ts` |
| The page | `app/routes/private-page.tsx`: the post reading layout, no description, Open Graph, canonical or JSON-LD |
| Serving and the beacon endpoint | `worker/pages.ts` |
| The beacon | `lib/pages/beacon.ts` |
| Stats storage | `worker/page-stats-room.ts` (`PageStatsRoom`, one SQLite Durable Object per page id) |
| Stats for the editor | `PageStatsApi` in `worker/index.ts` (a `WorkerEntrypoint`, reached over a service binding) |
| Aggregation | `lib/pages/stats.ts` (pure, unit tested, shared with the editor through the overlay build) |
| The editor screen | `editor/components/editor/Pages.tsx` and `editor/write/worker/pages.ts` in space-content |

A page file:

```md
---
title: "Hello, Acme"
description: "Optional, shown under the title"
date: 2026-11-13
expires: 2027-01-31        # optional: every link closes after this day (UTC, inclusive)
disabled: true             # optional: every link answers 404
links:
  - token: "x3...22 random base64url characters"
    label: "Hiring manager"  # only the owner sees it (editor and stats)
    expires: 2026-12-31      # optional: this link only; the earlier expiry wins
    revoked: true            # optional
---

Markdown, under the same rules as a post (no raw HTML, safe links, the dash rule).
```

## Serving

1. The build prerenders each page at `/p/<key>`, where `key` is the first 24 hex characters of
   `sha256("space-private-page\n" + id + "\n" + tokens)`: nothing anyone can work back to a token or the page id, and it
   changes whenever the links change. `build/client/_private/pages.json` maps each open token to its page, key and last
   day. Revoked links and disabled pages are left out of it; expiry is checked at request time.
2. The Worker runs first for every request (`run_worker_first`). It claims `/p/*` and `/_private/*`:
   `GET /p/<token>` (and `/p/<token>.data`, React Router's loader data for client navigation back to the page) fetches
   `/p/<key>` from the assets when the token is open today; everything else under those paths, the key path included,
   answers 404. The manifest is cached per isolate for a minute.
3. A served page carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`, `Cache-Control: private, no-store`,
   `Referrer-Policy: no-referrer` and no ETag; its head has a robots meta tag and `referrer: no-referrer`, and nothing an
   unfurler could show (no description, no Open Graph or Twitter tags).
4. The sitemap, feeds, search index and every listing are built from posts only; tests in `lib/__tests__/seo.test.ts`
   and `lib/rr/routes.test.ts` check that no `/p/` path reaches them.

**Revoking, expiring and turning off take a deploy.** The manifest is part of the build, so a change in the editor is
live only once its pull request is merged into space-content `main` and the dispatched Deploy has finished (a couple of
minutes). Expiry dates need no deploy: the Worker compares them with today's UTC date on each request.

## Analytics

The page sends small JSON events to `POST /api/pages/event` (`lib/pages/beacon.ts`):

- `view` once per page load, with the referrer (the Worker keeps only its host);
- `beat` every 15 seconds while the tab is visible, and `hide` when it is hidden or left (via `sendBeacon`), each with
  the visible time so far: time on page counts only while the page is in front;
- `click` on any link, with its target (a path for this site, host and path for another).

The Worker drops events from bots, speculative loads, other hosts (preview deployments, local development) and closed
or unknown tokens, still answering 204, and refuses cross-site posts (Origin and `Sec-Fetch-Site`), bodies over 1 KB
and other content types. It rate limits per IP and overall, in memory, never stores the IP, and records:

- `visitor`: a salted hash of IP and user agent that changes every UTC day (`LIVE_SALT` when set), for unique counts;
- `country` from Cloudflare (`request.cf.country`), `device` (mobile, tablet, desktop) from the user agent;
- `vid`: a random id the page makes up per load, kept in memory only. No cookies, no storage.

The editor shows views, unique visitors, average and median visible time (over loads that reported any), last opened,
views for the last 30 days, clicks by target, referrers, countries, devices, each link's own numbers, and recent visits.

### Why a Durable Object, not D1 or Analytics Engine

- The site already runs SQLite Durable Objects on the free plan (`PresenceRoom`, `ReactionsRoom`), so this is one more
  class in a migration (`v3` in `wrangler.jsonc`) and nothing for the owner to create: no database id, no binding to
  provision by hand, no dashboard step.
- Per page the data is tiny (capped at 20,000 visits and 50,000 clicks, oldest first), every write for a page goes
  through one object in order, so a beat can update its visit row without races, and a page nobody opens costs nothing.
- D1 would need a database created by hand and its id in config, and would put every page in one database for no
  benefit. Analytics Engine keeps 90 days, needs the SQL API with an API token to read, and cannot update a row in place.

### Why a service binding for the editor

The editor (Worker `write`, behind Cloudflare Access) reads stats through a service binding, `SITE_PAGES`, to the
`PageStatsApi` entrypoint of this Worker. A service binding is a direct Worker to Worker call inside the account: there
is no URL to find, no shared secret to set or leak, and nothing on the public internet can call it. `PageStatsApi` has
two read-only methods, `stats(ids)` (at most 100 pages) and `live()`. It cannot write. The binding needs both Workers in
the same account, which they are; until the `space` Worker with `PageStatsApi` is deployed, the editor shows that stats
are off (503) and everything else works.

## Local development

`npm run content:pull` brings `pages/` with posts. To try the Worker locally:

```sh
npm run build
npx wrangler dev --var PAGES_CANONICAL_HOST:127.0.0.1:8787
```

`PAGES_CANONICAL_HOST` is the host on which events are recorded (default `michal.ai`); set it only for local runs.

## Later: a resume variant on a page

The page body is a post body, so anything a post can embed a page can. A tailored resume would be its own directive
reading a variant by name from the resume data, kept out of the page file itself so a variant can be shared by several
pages. Nothing here assumes otherwise.
