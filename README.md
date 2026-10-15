# space

One repository, two independent sites, a few shared packages. npm workspaces (no Turborepo: two apps and
four small packages do not need a task graph; `npm run -w` is enough).

Working with an AI coding agent? Start from [`AGENTS.md`](AGENTS.md): rules, traps and the identity rule. App specifics are in
[`apps/halmic/AGENTS.md`](apps/halmic/AGENTS.md) and [`apps/michal-ai/AGENTS.md`](apps/michal-ai/AGENTS.md).

```
apps/
  michal-ai/   the portfolio (React Router 7 + Vite, every route prerendered, served by a plain Worker), Worker name `space`, https://michal.ai
  halmic/      halmic.com: zero-dependency static build plus one small Worker `halmic` (see apps/halmic/README.md)
packages/
  motion/      @space/motion  spring / stroke / petal-physics toolkit (TypeScript source, consumed via transpilePackages)
  tokens/      @space/tokens  design-token structure + tokens.json -> CSS generator (each app keeps its own values)
  config/      @space/config  shared tsconfig / eslint / prettier bases
  crosslinks/  @space/crosslinks  the one sanctioned link between the sites: logo switcher marks and the paired-content map
scripts/       repo-level checks (identity, dashes, slugs) and the post-deploy smoke test
docs/monorepo/ history of how the repo was assembled (restructure notes, PR plan, halmic merge); not current state
```

Each app builds and deploys on its own. Nothing in `packages/` talks to the network or knows which app uses it.

## Everyday commands (run at the repo root)

| Command | What it does |
| --- | --- |
| `npm ci` | install everything, one lockfile at the root (use `npm install` after pulling a change that adds a workspace package, or `@space/crosslinks` is not linked) |
| `npm run dev:michal` | portfolio dev server (also builds image variants first) |
| `npm run dev:halmic` | build halmic and serve it at http://localhost:4310/ |
| `npm run build:michal` / `build:halmic` | production build of one app |
| `npm run typecheck` / `lint` / `test` | across all workspaces that define the script |
| `npm run check:identity` | content identity guard (see below) |
| `npm run check:dashes` | no em or en dash in what the portfolio ships |
| `npm run check:slugs` | portfolio post slugs and redirects |
| `npm run check` | typecheck + lint + test + identity + dashes + slugs |
| `npm run deploy:michal` / `deploy:halmic` | build and deploy one Worker by hand (needs `wrangler login`; normally CI does this on merge to `main`) |

Inside an app directory the usual scripts still work: `cd apps/michal-ai && npm run deploy`.
Build-time scripts under `apps/michal-ai/scripts/` `chdir` to the app root themselves, so
`node apps/michal-ai/scripts/build-images.mjs` works from anywhere, and so do `npm run -w` invocations.
Every `process.cwd()` in the app (content reader, media manifest, OG fonts, `next.config.mjs` redirects, editor) assumes
the app root; Vite, vitest, wrangler and `npm -w` all start there.

## Where things live

- Portfolio code, content (`content/posts/*.md`), media, Worker (`worker/`), `wrangler.jsonc`, `open-next.config.ts`:
  `apps/michal-ai/`. The `@/` import alias is local to the app.
- Motion maths and hooks (`useSpring`, `useSpringSet`, `settle`, `handStroke`, `linearSpring`, `petalPhysics`...):
  `packages/motion/src`, imported as `@space/motion/<module>`.
- halmic: `apps/halmic/` (read its README). The sibling link between the two sites: `packages/crosslinks`.
- Token generator: `packages/tokens`. The portfolio's values stay in `apps/michal-ai/docs/design-system/tokens.json`;
  `npm run tokens -w @space/michal-ai` regenerates `app/styles/tokens.css`.

## Adding a shared package

1. `mkdir packages/<name>` with a `package.json` named `@space/<name>` (`"private": true`, `exports` pointing at source).
2. Add `"@space/<name>": "*"` to the consuming app's dependencies and run `npm install` at the root.
3. For TypeScript source packages add the name to `transpilePackages` in the app's `next.config.mjs`.
4. Give it a `test` and `typecheck` script; the root scripts pick them up automatically.
5. Do not share runtime code that carries identity (copy, names, URLs, analytics ids) between the two sites.

## Deploying

Merges to `main` deploy automatically through `.github/workflows/deploy.yml` (`ci.yml` still only verifies PRs).

On a push to `main`, for each app whose files (or `packages/`, `scripts/`, `package.json`, `package-lock.json`, the workflow or
`.github/actions/`) changed:

1. `preflight` checks that the `CLOUDFLARE_API_TOKEN` secret exists; if not, the deploy jobs are skipped with a warning (no red run).
2. `deploy-michal` (GitHub environment `production`, https://michal.ai): `npm ci`, typecheck + lint + tests + identity check,
   restore the generated-image cache, `npm run deploy:michal` (`react-router build`, share cards, then `wrangler deploy`), then a smoke
   test of `/`, `/sitemap.xml`, `/robots.txt` and `/projects/isat-dashboard` with retries. The Worker version id is printed and put
   in the run summary. Deploys queue (one at a time, never cancelled mid-flight).
3. `deploy-halmic` runs when the variable `DEPLOY_HALMIC` is `true` (it is) or on a manual run that chooses halmic. It runs the
   checks, builds, runs the identity check against the build output, deploys the Worker `halmic`, and smoke-tests `HALMIC_URL`
   if set (`/`, `/sitemap.xml`, `/robots.txt`, `/api/live`, `/api/clips`, `/games/taco-neko/`).

Generated images are cached between runs (`.github/actions/media-cache`): a cold image build takes minutes, a warm one seconds.

**Manual deploy:** GitHub, Actions, Deploy, Run workflow, pick `michal`, `halmic` or `both` (ignores change detection), or
`gh workflow run Deploy -f app=halmic`. Or locally from the repo root after `npx wrangler login`: `npm run deploy:michal` /
`npm run deploy:halmic`.

**Roll back:** from the app directory (wrangler reads its `wrangler.jsonc`):

```
cd apps/michal-ai && npx wrangler rollback            # previous version of Worker `space`
cd apps/michal-ai && npx wrangler deployments list    # find a version id, then: npx wrangler rollback <version-id>
```

Use `apps/halmic` for the `halmic` Worker. It needs the same Cloudflare login or `CLOUDFLARE_API_TOKEN`. Rollback also works from
the Cloudflare dashboard (Workers, `space`, Deployments). To roll back through the repository instead, revert the commit on `main`
and the revert deploys itself. A rollback is overwritten by the next merge that deploys.

**One-time setup (owner):**

| Where | Name | Value |
| --- | --- | --- |
| Settings, Secrets and variables, Actions, *Secrets* (repository secret, not environment-scoped) | `CLOUDFLARE_API_TOKEN` | API token below |
| Same page, *Variables* | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id (Workers dashboard sidebar) |
| Same page, *Variables* | `DEPLOY_HALMIC` | `true` (set) |
| Same page, *Variables* | `HALMIC_URL` | `https://halmic.com`, smoke-tested after deploy |
| Settings, Environments | `production` | created on first run; add required reviewers there for an approval gate |

Token: Cloudflare dashboard, My Profile, API Tokens, Create Token, start from the "Edit Cloudflare Workers" template, then restrict
Account Resources to this one account and drop the zone resources. The minimal set the current config needs is **Account, Workers
Scripts, Edit** (the Worker, its static assets and the Durable Object migration all go through it; `CLOUDFLARE_ACCOUNT_ID` is
provided, so no account-lookup permission is needed). The portfolio's custom domains are attached in the dashboard.
`apps/halmic/wrangler.jsonc` does declare `routes` (custom domains `halmic.com` and `www.halmic.com`), so the token must also be
able to manage them; if a halmic deploy fails on the routes step, add Zone, Workers Routes, Edit (and DNS as Cloudflare asks).
Never commit the token or paste it into logs.

If Cloudflare Workers Builds is also connected to these Workers, disconnect it, or every merge deploys twice.

## Identity separation

`halmic` is a handle; its site must not carry the owner's real name in anything it ships. `scripts/check-identity.mjs`
(run by CI and `npm run check`) fails when `apps/halmic` source, content, public files or build output matches a pattern in
`scripts/identity-denylist.txt` (docs and READMEs excluded). It also prints a soft warning when the portfolio's shipped copy
mentions the handle outside `scripts/identity-allowlist.txt`. The link between the two at the repository level is accepted.

**The one door (owner's decision, 2026-10-12).** The sites now link to each other, through exactly these things and no other:
the logo switcher (hover or focus the logo, one row with the other site's mark and domain; the same row in the phone menu on
michal.ai and in Halmic's footer for touch screens), and one link on each page that is genuinely the same piece on both sites.
The pairs live in `packages/crosslinks/src/pairs.mjs` (michal.ai post id to Halmic path). The check reads that map and allows,
in built Halmic HTML only, the exact strings the build emits for the switcher (twice per page: header and footer) and for the
page's own pair (once, on that page); a second mention, a URL that is not in the map, or the same link on another page fails.
The owner also approved outbound links to his own X posts, in one exact status-URL form that `scripts/identity-lib.mjs` exempts.
Real name, initials and everything else in `identity-denylist.txt` still fail everywhere. Adding the sibling site to either
site's metadata, JSON-LD `sameAs`, sitemap, feeds or footer credits is deliberately not done. To pair another piece, add a row
to `pairs.mjs`; `npm test -w @space/crosslinks` proves both targets exist and that the michal.ai one is live and not a redirect.

## Could be shared later (deliberately not extracted yet)

`components/glass` (Liquid Glass; geometry already uses `@space/motion`), `components/shader-image`, `components/backdrop`,
`components/ui` (micro-UI kit), `lib/content` (markdown pipeline), `lib/og`. Extract when halmic actually needs one of them,
and only the parts that carry no copy or branding.
