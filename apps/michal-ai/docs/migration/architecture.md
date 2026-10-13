# How the site is built now (React Router 7 + Vite, prerendered, plain Worker)

Replaces the Next 15 + OpenNext setup. Rollback: `rollback.md`. How equivalence was checked: `scripts/parity/README.md`. The original plan and
inventory: `plan.md` (kept as written; where it differs from this file, this file is current).

## Pipeline

```
npm run build -w @space/michal-ai
  prebuild   build-images, build-embeds, build-live-slugs, build-starlink     (unchanged)
             build-worker-redirects   worker/redirects.generated.ts from content/redirects.json
             build-share-cards        .cache/share-cards/*.png + hashes (satori 0.15.2 + resvg, via vite-node)
  build      react-router build       build/client: HTML for every route, <path>.data loader results, hashed JS/CSS
             build-share-cards --after-build   copies cards to build/client/_og, removes files the Worker never serves
deploy       wrangler deploy          worker/index.ts + assets from build/client
```

`react-router.config.ts`: `ssr: false`, `prerender()` lists every path from the post front matter (`lib/redirects.mjs` `readPostPaths`) plus the
feeds, sitemap, robots, manifest and `/404`. Loaders run in Node at build time; the server bundle is deleted afterwards. Nothing needs Node at runtime.
Under `react-router dev` the same routes render on request (`ssr: true`).

## Where things live

- `app/root.tsx` the shell (nav, backdrop, page-enter wrapper that replaces `template.tsx`, page end, footer), global CSS in the old order, font preloads.
  Its loader sends post metadata (no bodies), the menu previews and the page-end link.
- `app/routes.ts` the route table. Dev tools (`/write`, labs) are added only when `NODE_ENV === 'development'`; `lib/rr/routes.test.ts` asserts production
  has none. `app/routes/*.tsx` are thin wrappers: a loader (head tags, the image entries the page renders, markdown as hast) around the existing
  page components (`app/page.tsx`, `app/about/page.tsx`, ... are unchanged apart from the `Link` import).
- `lib/nav.tsx` is the only place components get `Link`, `usePathname`, `useRouter` from.
- `lib/rr/head.ts` turns the `Metadata` objects from `lib/seo.ts` into `meta()` descriptors the way Next emitted them (`lib/meta-types.ts` holds the
  types). `lib/rr/content.server.ts` is loader-only (`.server` keeps it out of the browser).
- Browser twins swapped in by `vite.config.mts` (client build only): `lib/media/client.ts` (image entries registered by the route loader instead of
  reading `manifest.json`) and `lib/content/source.client.ts` (posts registered from the root loader). Server code and components are the same files.
- `lib/content/render.tsx` runs the markdown pipeline in loaders and returns hast; `lib/content/to-react.tsx` is the small converter that runs everywhere.
- Fonts: `app/styles/fonts.css` and `public/fonts/` hold the exact @font-face rules and woff2 files the Next build generated (Newsreader, IBM Plex Mono
  are OFL; Michelangelus as before), including the `size-adjust` fallbacks. `PRELOAD_FONTS` in `app/root.tsx` preloads the same ten files.
- `worker/index.ts` host redirect, Starlink binary, `/api/live/*`, then `worker/static.ts` (legacy redirects, trailing slash, share-card URLs, content
  types, prerendered 404 with status 404) in front of `env.ASSETS`. `wrangler.jsonc` sets `run_worker_first`, `html_handling: drop-trailing-slash`,
  `not_found_handling: none`. Durable Objects, vars, migrations and the cron are untouched.
- Dev only: `vite/dev-api.ts` serves `app/api/write/**/route.dev.ts` (the writing tool's file API); `app/dev/*` wraps the editor pages with loaders.

## Known differences from the Next build

See the list in the PR description / report: asset paths (`/assets`, `/fonts`), no RSC payload (replaced by `__reactRouterContext` and `.data` files),
HTML `Cache-Control` is revalidating instead of `s-maxage`, share-card hash values differ, links prefetch on intent, dev-only font fallbacks.
`NEXT_PUBLIC_GLASS` (NavBar) is still read as `process.env.NEXT_PUBLIC_GLASS`, defined at build time in `vite.config.mts`.
