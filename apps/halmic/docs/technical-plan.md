# halmic.com: technical plan

## Stack
Static-first Next.js (App Router, `output: export`-style prerender for every page) deployed to Cloudflare Workers with OpenNext, like the portfolio, plus one small Worker route group. Tokens from `tokens.json` to CSS variables (same builder). Meter, spring and reveal helpers from a shared `toolkit/` copy. No analytics or third-party requests before interaction.

## Live status endpoint (`GET /api/live`)
- Twitch Helix `GET https://api.twitch.tv/helix/streams?user_login=halmictv` with an **app access token** (client-credentials grant). No user login, no chat scopes.
- Token cached in memory and in `caches.default` under a synthetic key (TTL = `expires_in - 300s`); refreshed once on 401. No KV, so deploy needs no setup.
- Response cached with the Cache API for 45 seconds, `stale-while-revalidate=300`, so any number of visitors costs about 1 Helix call per minute.
- Returns only what the UI needs: `{ live, title, game, startedAt, thumbnail?, checkedAt }`. No viewer count (the stream is small and the number would hurt more than help).
- Fallback ladder: fresh, stale (served and revalidated), last-known from KV, then `{ live: false, unknown: true }`. The page then shows "offline" without a date, never an error, and the field/bars simply rest.
- Client: fetch once on load, then every 60s only while the tab is visible and the page is in view; flips the same `data-live` attribute the prototype toggles; bars spring to the new state. No client secrets.
- SEO: crawlers get the static page. While live, an HTMLRewriter step on the edge injects a `BroadcastEvent` (`isLiveBroadcast: true`) JSON-LD block from the cached status.

## Schedule and clips
- `GET /api/schedule`: Helix `GET /schedule?broadcaster_id=` (cache 1h; 404 when no schedule exists, which is the current state, so the UI says so).
- `GET /api/clips`: Helix `GET /clips?broadcaster_id=&first=20` (cache 1h). Clip thumbnails are fetched once by the Worker and cached in R2 or the Cache API so the page makes no third-party image requests. Titles and durations are real text.
- Player: Twitch embed (`player.twitch.tv`, requires `parent=halmic.com`) and YouTube (`youtube-nocookie.com`) only after click or tap; before that, a link with a local thumbnail.

## Videos
- `halmic/scripts/sync-youtube.mjs` reads the public channel feed (latest 15, no key), writes `content/videos.json` and local thumbnails; tolerant of failure (keeps the last good file); a deny-list (`content/identity-denylist.txt`) holds back entries that match and writes them to `videos.held.json` for review.
- Run at build time (`npm run sync:youtube`); a Workers cron trigger can rebuild weekly.
- Full back catalogue (22 videos, view counts, playlists) needs the YouTube Data API key (owner creates it in Google Cloud, read-only, restricted to YouTube Data API v3) or a hand-kept `videos.manual.json` list. The prototype does not scrape beyond the public feed and channel pages.
- A curated featured video is a hard-coded id in the page data, not the newest.

## SEO and structured data
- `Person` (name "halmic", alternateName "halmicTV") or a legal-free `Brand`; no real-name fields, no `Organization` legal claims (the Ltd is dissolved). `sameAs`: Twitch, YouTube, X (@halmicc) only, with `rel="me"` on the corresponding links.
- `WebSite`, `VideoObject` per video (name, thumbnailUrl absolute, uploadDate, embedUrl, contentUrl), `BroadcastEvent` while live, `CreativeWork` per case study later.
- Title "halmic", unique description; OG image generated from the wordmark; sitemap and robots; `lang="en"`.
- Identity hygiene: no real-name strings in HTML, JSON-LD, alt text, image EXIF (strip on build), humans/llms files, source maps or client bundles; CI step greps for the deny-list (`halmic/content/identity-denylist.txt`) and fails the build on a hit.

## Owner setup
1. **Twitch developer application** at https://dev.twitch.tv/console (requires 2FA on the Twitch account): name "halmic site", OAuth redirect `http://localhost` (required but unused), category "Website Integration", client type Confidential. Give me nothing in chat: run `wrangler secret put TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` himself (I never see them).
2. Cloudflare: add halmic.com as a zone (or Workers route on the existing account), create KV namespace `HALMIC_KV`.
3. **Domain**: halmic.com currently 302-redirects to the portfolio. Remove that redirect at the registrar/DNS and point it at the Worker at launch. Decide halmic.co / halmic.tv.
4. Optional: YouTube Data API key; Twitch schedule segments (so the schedule renders).
5. Decide on the writing section and the held YouTube entries (see discovery questions).

## No link to or from the portfolio
By owner decision the persona is not tied to the real name: no outbound link, no `sameAs`, no footer line, no shared analytics, no shared cookies. The portfolio must not link to halmic.com either unless he later changes his mind. The shared design DNA is the only public connection.

## Performance and accessibility budget
LCP under 2s on a mid phone: the hero is static HTML plus inline SVG wordmark (about 8 KB) and CSS; the field is about 20 DOM nodes updated by one rAF loop that pauses off-screen and when hidden; thumbnails lazy; no web fonts blocking. `prefers-reduced-motion`: still bars, no breathing. Keyboard order = visual order; focus ring everywhere; contrast AA.
