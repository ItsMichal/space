# halmic

The site for halmic.com: streams, videos, tiny games and design. A static build (zero runtime dependencies) plus one small Worker (`/api/live`, `/api/clips`, `/api/clip-thumb/<id>`). Deploys as the Cloudflare Worker `halmic`.

- `src/index.html` + `build.mjs`: the home template and the generator for every other page (games, videos, design, 404), `sitemap.xml`, `robots.txt`, `rss.xml`, `llms.txt` and `_headers`. `content/` holds the data, `brand/` the logotype generator and SVGs.
- `public/`: hand-kept files (`*.css`, `app.js`, fonts, images) and build output (html, sitemap, rss, robots, llms.txt, `_headers`); all tracked. CSS/JS are linked as `?v=<content hash>` by the build, which is why `_headers` can cache them for a year.
- `worker/index.js`: `GET /api/live` (Twitch Helix, cached 45s, no KV) and `GET /api/clips`. Only `/api/*` runs the Worker (`assets.run_worker_first`); everything else is served from `public/`.
- `scripts/`: `check-links.mjs` (runs in `npm test`), `sync-youtube.mjs`, `sync-itch.mjs`, `build-og.mjs`, `shot.mjs` (headless Chrome screenshots, needs `ws`; Chrome from `CHROME_PATH`, else macOS Chrome, else `/opt/pw-browsers/chromium`).
- `docs/`: discovery (contains an INTERNAL section), design system, technical plan, SEO notes.

## Develop
From the repo root: `npm run dev:halmic` builds and serves http://localhost:4310/ (`serve.mjs`, no-store; answers `/api/live` with an "unknown" payload and unknown paths with `404.html`). After editing, `npm run build:halmic` and reload.

`?live=1` (optionally `&game=Minecraft`) forces the on-air look and skips the fetch; `?live=0` forces offline. Not linked from the UI; for testing only.

`GET /api/clips` returns the six most-viewed clips of the channel (`{ clips: [{ id, title, game, duration, url, createdAt }], checkedAt }`; no view counts, creators or thumbnails), cached an hour; the broadcaster id is cached for a day. The home page replaces its hand-typed clip list with these and plays a clip inline (Twitch embed iframe, `frame-src https://clips.twitch.tv`) when a row is clicked. Without secrets or on any Twitch error it answers `{ clips: [], unknown: true }` and the built list stays. `?clips=demo` swaps in six fake clips (local video thumbnails) and skips the fetch, to check the layout locally.

## Icons
Icons live in `brand/icons/` and are built into one same-origin sprite, `public/icons.svg`, by `build.mjs` (linked as `/icons.svg?v=<hash>`, immutable cache). In templates, `icon('play')` returns `<svg class="ic" aria-hidden="true"><use href="/icons.svg?v=…#play"/></svg>`; icons are sized in `em` and take the surrounding text colour. Decorative icons are `aria-hidden`; an icon-only control must carry an `aria-label`.
- UI icons: [Phosphor Icons](https://phosphoricons.com) 2.1.1, **Fill** weight (sits best next to the heavy display face; `x` is the Bold glyph because Fill's is a boxed X), MIT. Files in `brand/icons/phosphor/` with the licence (`LICENSE`). Name = file name, for example `arrow-up-right`.
- Brand marks (Twitch, YouTube, Discord, X, itch.io, Medium): [Simple Icons](https://simpleicons.org) 16.35.0, CC0, used unmodified in one colour. Files in `brand/icons/brands/` with `LICENSE.md` and `DISCLAIMER.md` (the marks are their owners' trademarks). Name = `b-` plus the file name, for example `b-twitch`, `b-itchdotio`.
- The Noun Project is a style reference only; nothing is copied from it.
- To add one: fetch the SVG from the npm package (`npm pack @phosphor-icons/core` or `simple-icons` into a temp dir, never as a dependency), copy only that file into the matching folder, rebuild, and use `icon('name')`. An unknown name throws at build time, and `scripts/check-links.mjs` fails on any `<use>` whose symbol is missing from the sprite.

## Test
`npm test -w @space/halmic`: unit tests for the Worker (`node --test`, mocked `fetch`) and `scripts/check-links.mjs` (every internal link/asset/og:image in `public/` resolves, no placeholders, one h1, images have alt and size). Also run `npm run check:identity` from the root.

## Deploy
`npm run deploy:halmic` from the root (or the Deploy workflow). Dry run: `cd apps/halmic && npx wrangler deploy --dry-run`.

Secrets, set once (create a Twitch app at dev.twitch.tv/console, client-credentials only, no user scopes):
```
cd apps/halmic
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler secret put TWITCH_CLIENT_SECRET
```
Without them `/api/live` answers `{ "live": false, "unknown": true }` and the page simply shows offline.

## Launch checklist
1. Add the halmic.com zone in the Cloudflare account (nameservers at the registrar).
2. `wrangler.jsonc` already has the `routes` for `halmic.com` and `www.halmic.com` and turns the workers.dev address off; the deploy fails until the zone exists.
3. `npm run deploy:halmic`, then set the two Twitch secrets above.
4. Remove the registrar's URL forward for the domain.
5. In GitHub, set repository variables `DEPLOY_HALMIC=true` and `HALMIC_URL=https://halmic.com` so merges to main deploy and are smoke-tested.
6. Redirect `www` to the apex with a Cloudflare redirect rule (not in code).

## Identity rule
No real name and no portfolio domain anywhere in `src/`, `public/`, `brand/` or `worker/`. Check with `npm run check:identity` (patterns in `content/identity-denylist.txt`). The rule is about printing: the name is not shown on the site, but outbound links to external pages that show it (Medium, LinkedIn) are fine, as long as the URL itself does not contain the name or the portfolio domain.
