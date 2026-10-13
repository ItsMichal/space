# halmic

The site for halmic.com: streams, videos, tiny games and design. A static build (zero runtime dependencies) plus one small Worker (`/api/live`, `/api/clips`, `/api/clip-thumb/<id>`, `/api/game-art/<id>`). Deploys as the Cloudflare Worker `halmic` (https://halmic.com). Agents and contributors: read [`AGENTS.md`](AGENTS.md) too.

- `src/index.html` + `build.mjs`: the home template and the generator for every other page (games, videos, design, work pages, 404), `sitemap.xml`, `robots.txt`, `rss.xml`, `llms.txt`, `_headers` (the CSP) and the icon sprite. `content/` holds the data (JSON and markdown), `brand/` the logotype generator, icons, display font and the media pipelines.
- `public/`: hand-kept files (`*.css`, `app.js`, `hero.js`, `switcher.*`, fonts, images, `hero/`, `previews/`, `og/`, `posts/`) and build output (html, sitemap, rss, robots, llms.txt, `_headers`, `icons.svg`, `previews/index.json`); all tracked, so rebuild and commit after every change. CSS/JS are linked as `?v=<content hash>` by the build, which is why `_headers` can cache them for a year.
- `worker/index.js`: `GET /api/live` (Twitch Helix, cached 45s, no KV), `GET /api/clips` and the two image proxies. Only `/api/*` runs the Worker (`assets.run_worker_first`); everything else is served from `public/`.
- `scripts/`: `check-links.mjs` and `check-social.mjs` (both run in `npm test`), `check-holes.mjs` (bento packing, needs Chrome and a running server), `sync-youtube.mjs`, `sync-itch.mjs`, `build-og.mjs` (share cards), `shot.mjs` (headless Chrome screenshots; `ws` and `sharp` come from the root `node_modules`; Chrome from `CHROME_PATH`, else macOS Chrome, else `/opt/pw-browsers/chromium`).
- `brand/`: logotype and display-font generators, icon sources (`icons/`), the hero reel pipeline ([`brand/reel/`](brand/reel/README.md)) and the hover-preview pipeline ([`brand/previews/`](brand/previews/README.md)).
- `docs/`: early planning notes (discovery, design system, technical plan, SEO). Historical: parts no longer match the site (see Open items in `AGENTS.md`).

## Develop
From the repo root: `npm run dev:halmic` builds and serves http://localhost:4310/ (`serve.mjs`, no-store; answers `/api/live` with an "unknown" payload and unknown paths with `404.html`). After editing, `npm run build:halmic` and reload. `PORT=<n>` changes the port. `serve.mjs` sends no CSP; to try the real `_headers` and Worker together, run `npx wrangler dev --cwd apps/halmic --port 8788` from the repo root.

`?live=1` (optionally `&game=Minecraft`) forces the on-air look and skips the fetch; `?live=0` forces offline. `?reelq=0..3` pins the hero reel quality. Not linked from the UI; for testing only.

`GET /api/clips` returns the six most-viewed clips of the channel (`{ clips: [{ id, title, game, duration, url, createdAt, thumb, gameArt? }], checkedAt }`; no view counts, creators or Twitch image urls; `gameArt` is `/api/game-art/<game id>` when Twitch has box art for the game), cached an hour; the broadcaster id is cached for a day. The home page replaces its hand-typed clip list with these and plays a clip inline (Twitch embed iframe, `frame-src https://clips.twitch.tv`) when its tile is clicked. `GET /api/game-art/<id>` proxies the box art of a game that one of the cached clips is from (numeric ids only, `image/*` only, cached a day), like `/api/clip-thumb/<id>`. Without secrets or on any Twitch error it answers `{ clips: [], unknown: true }` and the built stand-in tiles stay; an answer with no clips removes them (Watch is then videos only). `?clips=demo` swaps in six fake clips (local video thumbnails, inline stand-in box art) and skips the fetch, `&n=3` shows three, `?clips=none` none, to check the layout locally.

## Layout: bentos
The home page body is bentos (`.bento`): Watch (Twitch clips and YouTube videos in one grid, told apart by a round platform badge: purple Twitch, red YouTube), Play and Work side by side from 1100px, then Elsewhere. Tiles come in three sizes (1x1, 2x1, 2x2 on a square unit) and are one idea each: a picture, a big word/number (stat tiles: numbers come from the content files, never typed in), or a brand mark on its brand colour (link tiles). The column count follows the bento's own width (container query: 4 from 880px, 3 from 640px, else 2) and `app.js` sets the width of the one `data-flex` tile so the last row is always full; a tile that is playing grows to 2x2. `?clips=demo&n=0..6` and `?clips=none` are the quick way to check packing with fewer clips. Platform colours are only for badges and link tiles.

## Icons
Icons live in `brand/icons/` and are built into one same-origin sprite, `public/icons.svg`, by `build.mjs` (linked as `/icons.svg?v=<hash>`, immutable cache). In templates, `icon('play')` returns `<svg class="ic" aria-hidden="true"><use href="/icons.svg?v=…#play"/></svg>`; icons are sized in `em` and take the surrounding text colour. Decorative icons are `aria-hidden`; an icon-only control must carry an `aria-label`.
- UI icons: [Phosphor Icons](https://phosphoricons.com) 2.1.1, **Fill** weight (sits best next to the heavy display face; `x` is the Bold glyph because Fill's is a boxed X), MIT. Files in `brand/icons/phosphor/` with the licence (`LICENSE`). Name = file name, for example `arrow-up-right`.
- Brand marks (Twitch, YouTube, Reddit, X, itch.io, Medium): [Simple Icons](https://simpleicons.org) 16.35.0, CC0, used unmodified in one colour. Files in `brand/icons/brands/` with `LICENSE.md` and `DISCLAIMER.md` (the marks are their owners' trademarks). Name = `b-` plus the file name, for example `b-twitch`, `b-itchdotio`.
- The Noun Project is a style reference only; nothing is copied from it.
- To add one: fetch the SVG from the npm package (`npm pack @phosphor-icons/core` or `simple-icons` into a temp dir, never as a dependency), copy only that file into the matching folder, rebuild, and use `icon('name')`. An unknown name throws at build time, and `scripts/check-links.mjs` fails on any `<use>` whose symbol is missing from the sprite.

## Posts (X highlights)
`content/posts.json` feeds an optional `Posts` bento on the home page (anchor `#posts`): static tiles, no widget or third-party request, media copied into `public/posts/` (neutral names, 1200px, 200 KB at most) with alt text written by hand, the post text trimmed to the title. While the list is empty the section is not rendered. Extra fields: `kind` (web, game, hardware, design, video, music: icon on the chip, label for screen readers) and `video: true` (the media is a poster frame, adds a play glyph). Post links may point at any x.com status; the identity check only exempts that exact URL form.

## Test
`npm test -w @space/halmic`: unit tests for the Worker (`node --test`, mocked `fetch`), `scripts/check-links.mjs` (every internal link/asset/og:image in `public/` resolves, no placeholders, one h1, images have alt and size, preview size budgets) and `scripts/check-social.mjs --dir public` (Open Graph and Twitter tags and card images for every page in the sitemap). Also run `npm run check:identity` from the root.

Not in `npm test`: `PORT=4563 node serve.mjs` then `node scripts/check-holes.mjs` (every home bento hole-free at 4/3/2 columns, needs Chrome), and the live social audit `node scripts/check-social.mjs https://halmic.com --ua=Twitterbot/1.0`. Share cards are rebuilt with `npm run og -w @space/halmic` (needs Chrome).

## Deploy
Merging to `main` deploys it: the GitHub Actions `Deploy` workflow builds, runs the checks and the identity check, runs `wrangler deploy` and smoke-tests the site (see the root README). Redeploy without a code change: `gh workflow run Deploy -f app=halmic`. Dry run: `cd apps/halmic && npx wrangler deploy --dry-run`. `npm run deploy:halmic` exists for a manual deploy after `wrangler login`.

Secrets, set once (create a Twitch app at dev.twitch.tv/console, client-credentials only, no user scopes):
```
cd apps/halmic
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler secret put TWITCH_CLIENT_SECRET
```
Without them `/api/live` answers `{ "live": false, "unknown": true }` and the page simply shows offline.

## Domain
halmic.com is registered at Porkbun; its nameservers point at Cloudflare, where the zone lives in the owner's account. `wrangler.jsonc` declares the `routes` (custom domains `halmic.com` and `www.halmic.com`) and turns the workers.dev address and preview URLs off, so the custom domain is the only address. The `www` to apex redirect is a Cloudflare redirect rule, not code. GitHub repository variables `DEPLOY_HALMIC=true` and `HALMIC_URL=https://halmic.com` make merges deploy and get smoke-tested.

## Identity rule
No real name and no portfolio domain anywhere in `src/`, `public/`, `brand/` or `worker/`, in text, file names or the pixels of images and video. Check with `npm run check:identity` from the root (a hard CI gate). The rule is about printing: the name is not shown on the site, but outbound links to external pages that show it (Medium, LinkedIn, the owner's X posts) are fine, as long as the URL itself does not contain the name or the portfolio domain. The sanctioned exceptions are the logo switcher and paired-content links (`packages/crosslinks`) and the X post URL form that `scripts/identity-lib.mjs` exempts; the root `AGENTS.md` has the full rule.
