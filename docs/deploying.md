# Deploying

How the three Workers ship. The short version is in the [README](../README.md#deploying).

## How it works

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

## Manual deploy

GitHub, Actions, Deploy, Run workflow, pick `michal`, `halmic` or `both` (ignores change detection), or
`gh workflow run Deploy -f app=halmic`. Or locally from the repo root after `npx wrangler login`: `npm run deploy:michal` /
`npm run deploy:halmic`.

## Roll back

from the app directory (wrangler reads its `wrangler.jsonc`):

```
cd apps/michal-ai && npx wrangler rollback            # previous version of Worker `space`
cd apps/michal-ai && npx wrangler deployments list    # find a version id, then: npx wrangler rollback <version-id>
```

Use `apps/halmic` for the `halmic` Worker. It needs the same Cloudflare login or `CLOUDFLARE_API_TOKEN`. Rollback also works from
the Cloudflare dashboard (Workers, `space`, Deployments). To roll back through the repository instead, revert the commit on `main`
and the revert deploys itself. A rollback is overwritten by the next merge that deploys.

## One-time setup (owner)

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

The `sports` app (`apps/sports`, Worker `halmic-sports`) has its own deploy job behind the `DEPLOY_SPORTS` variable; see [`apps/sports/README.md`](../apps/sports/README.md).
