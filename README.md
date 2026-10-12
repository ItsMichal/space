# space

One repository, two independent sites, a few shared packages. npm workspaces (no Turborepo: two apps and
three small packages do not need a task graph; `npm run -w` is enough).

```
apps/
  michal-ai/   the portfolio (Next 15 on Cloudflare Workers via OpenNext), Worker name `space`, https://michal.ai
  halmic/      halmic.com (arrives through its own PR, see apps/halmic/README.md)
packages/
  motion/      @space/motion  spring / stroke / petal-physics toolkit (TypeScript source, consumed via transpilePackages)
  tokens/      @space/tokens  design-token structure + tokens.json -> CSS generator (each app keeps its own values)
  config/      @space/config  shared tsconfig / eslint / prettier bases
scripts/       repo-level checks (identity guard)
docs/monorepo/ restructure notes, PR plan, how to bring halmic in
```

Each app builds and deploys on its own. Nothing in `packages/` talks to the network or knows which app uses it.

## Everyday commands (run at the repo root)

| Command | What it does |
| --- | --- |
| `npm ci` | install everything, one lockfile at the root |
| `npm run dev:michal` | portfolio dev server (also builds image variants first) |
| `npm run dev:halmic` | halmic dev server (after halmic is merged) |
| `npm run build:michal` / `build:halmic` | production build of one app |
| `npm run typecheck` / `lint` / `test` | across all workspaces that define the script |
| `npm run check:identity` | content identity guard (see below) |
| `npm run check` | typecheck + lint + test + identity |
| `npm run deploy:michal` / `deploy:halmic` | build and deploy one Worker by hand (needs `wrangler login`; merges to main do this in CI) |

Inside an app directory the usual scripts still work: `cd apps/michal-ai && npm run deploy`.
Build-time scripts under `apps/michal-ai/scripts/` `chdir` to the app root themselves, so
`node apps/michal-ai/scripts/build-images.mjs` works from anywhere, and so do `npm run -w` invocations.
Every `process.cwd()` in the app (content reader, media manifest, OG fonts, `next.config.mjs` redirects, editor) assumes
the app root; Next, vitest, OpenNext and `npm -w` all start there.

## Where things live

- Portfolio code, content (`content/posts/*.md`), media, Worker (`worker/`), `wrangler.jsonc`, `open-next.config.ts`:
  `apps/michal-ai/`. The `@/` import alias is local to the app.
- Motion maths and hooks (`useSpring`, `useSpringSet`, `settle`, `handStroke`, `linearSpring`, `petalPhysics`...):
  `packages/motion/src`, imported as `@space/motion/<module>`.
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
   restore the generated-image cache, `npm run deploy:michal` (OpenNext build, then `opennextjs-cloudflare deploy`), then a smoke
   test of `/`, `/sitemap.xml`, `/robots.txt` and `/projects/isat-dashboard` with retries. The Worker version id is printed and put
   in the run summary. Deploys queue (one at a time, never cancelled mid-flight).
3. `deploy-halmic` is dormant until launch: it only runs when the variable `DEPLOY_HALMIC` is `true` (or on a manual run that
   chooses halmic). It runs the identity check against the build output, deploys the Worker `halmic`, and smoke-tests `HALMIC_URL` if set.

Generated images are cached between runs (`.github/actions/media-cache`): a cold image build takes minutes, a warm one seconds.

**Manual deploy:** GitHub, Actions, Deploy, Run workflow, pick `michal`, `halmic` or `both` (ignores change detection). Or locally
from the repo root after `npx wrangler login`: `npm run deploy:michal` / `npm run deploy:halmic`.

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
| Same page, *Variables*, at halmic launch | `DEPLOY_HALMIC` | `true` |
| Same page, *Variables*, optional | `HALMIC_URL` | e.g. `https://halmic.com`, smoke-tested after deploy |
| Settings, Environments | `production` | created on first run; add required reviewers there for an approval gate |

Token: Cloudflare dashboard, My Profile, API Tokens, Create Token, start from the "Edit Cloudflare Workers" template, then restrict
Account Resources to this one account and drop the zone resources. The minimal set the current config needs is **Account, Workers
Scripts, Edit** (the Worker, its static assets and the Durable Object migration all go through it; `CLOUDFLARE_ACCOUNT_ID` is
provided, so no account-lookup permission is needed). The custom domains are already attached and no `wrangler.jsonc` declares
`routes`, so `wrangler deploy` does not touch zone settings. Add Zone, Workers Routes, Edit only if you later add `routes` or
`custom_domain` to a wrangler config. Never commit the token or paste it into logs.

If Cloudflare Workers Builds is also connected to these Workers, disconnect it, or every merge deploys twice.

## Identity separation

`halmic` is a handle; its site must not carry the owner's real name in anything it ships. `scripts/check-identity.mjs`
(run by CI and `npm run check`) fails when `apps/halmic` source, content, public files or build output matches a pattern in
`scripts/identity-denylist.txt` (docs and READMEs excluded). It also prints a soft warning when the portfolio's shipped copy
mentions the handle outside `scripts/identity-allowlist.txt`. The link between the two at the repository level is accepted.

## Could be shared later (deliberately not extracted yet)

`components/glass` (Liquid Glass; geometry already uses `@space/motion`), `components/shader-image`, `components/backdrop`,
`components/ui` (micro-UI kit), `lib/content` (markdown pipeline), `lib/og`. Extract when halmic actually needs one of them,
and only the parts that carry no copy or branding.
