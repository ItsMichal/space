# Baseline (golden) report: Next 15 build of origin/main at b28dec0

Captured with `scripts/parity/` (see its README). Golden outputs live in the git-ignored `apps/michal-ai/.parity/`.

## What the golden build is

- `next build` (Next 15.5.27), served by `next start` (not OpenNext/wrangler; the Worker routes `/api/live/*` and `/globe/starlink-live.bin` are not part of the golden snapshot and are exercised against the new Worker with `wrangler dev` in Phase 3; the Worker files are reused unchanged).
- 115 prerendered paths (pages, feeds, share-card images).
- First Load JS per route (Next report): shared 103 kB; `/` 126 kB; `/projects` 128 kB; `/about` and `/resume` 108 kB; `/writing` 109 kB; every post, project and child page 145 kB.
- Build environment note: `next/font/google` hangs in the sandbox (Node fetch does not use the proxy). The golden was built with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` pointing at a preload that fetches the real Google CSS and font files with curl and hands Next local paths, so the emitted fonts are the real ones. Those same woff2 files are what the new stack self-hosts.

## Snapshot contents (1361 URLs)

34 sitemap pages (200), 17 fixed resources (feeds, sitemap, robots, manifest, icons, PDFs; 200), 59 redirect sources (all 308, one hop, `location` is the current path), 5 trailing-slash probes (308 to the slash-less path), 9 missing paths (404, noindex page `Page not found`, `cache-control: no-store`), 1237 same-origin references made by pages (all 200).

Facts captured per HTML page: title, `<html>`/`<body>` attributes, every `<meta>` and head `<link>` (build-asset names normalised), JSON-LD parsed, heading outline, anchors, images (src/srcset/alt/width/height/loading/fetchpriority), `<source>` sets, normalised text of `<main>`.

## Things in the golden that the new build must reproduce or consciously change

- Head: 10 `<link rel=preload as=font>` (the fonts), 10 CSS files, `meta name=next-size-adjust` (Next only; will be absent), `og:image` is `https://michal.ai/opengraph-image?<16 hex>` (a content hash query; the new build keeps the URL shape with its own hash), `<link rel=manifest>`, canonical without trailing slash, `og:type=profile` on home and about.
- `<html class="__variable_.. __variable_.. __variable_..">` (font variable classes; will differ, replaced by equivalent CSS variables).
- Next serves HTML with `Cache-Control: s-maxage=31536000` and `x-nextjs-*` headers (cache class `long`); the Worker assets default is revalidate. Expected intentional difference unless the Worker sets the same header.
- Next 404: `cache-control: no-store`.
- `/write`, `/api/write/*` and every `*.dev.tsx` route are 404 in the production build (the new build must also 404 them).

## Noise floor of the harness

Two screenshot passes against the same golden server: 29 images (14 routes x 2 viewports + phone menu), worst difference 0.363% of pixels (`child-week-5-6.phone`), most 0.000%. Default failure threshold is 0.5%.

## Behaviour smoke on the golden (`behave.mjs`)

Pass: reading theme attribute set while the document is still parsing; hero canvases mount (4); client navigation keeps the document; nav marks the current section; `.page-enter` present; card click navigates in place; back returns home in place; logo switcher menu reveals on hover; project filter changes selection; timeline selects another entry; lightbox opens; no uncaught exceptions on home.
Advisory (flaky on the golden itself, reported but not gating): `data-vt` cleared after the card transition settles; reactions/views request issued (lazy, needs viewport timing).

## Sandbox constraint to know about

Binding or connecting to localhost is blocked by the default sandbox here (`sandbox.network.allowLocalBinding: true` fixes it), so the servers and Chrome runs for the harness were executed with the sandbox disabled for those commands only.
