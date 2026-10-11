# Bringing `halmic-site` into the monorepo

`halmic-site` was cut from the old single-app layout and keeps everything under a top-level `halmic/` folder
(`halmic/site`, `halmic/brand`, `halmic/docs`, `halmic/scripts`, `halmic/content`). Its merge base is the pre-release-2
`overhaul` commit `d30cbd2`; it touches nothing outside `halmic/`, so the merge is mechanical.

Do this only after the other agent's second round on `halmic-site` is finished.

## 1. Merge with rename detection

```bash
git switch monorepo            # or the branch the monorepo PR was merged into
git switch -c halmic-into-monorepo
git merge --no-ff halmic-site -m 'Merge halmic-site'
git status   # expect only new halmic/** files
```

This was dry-run against the monorepo branch: the merge is clean with no conflicts, because `halmic-site` only adds
`halmic/**` and never touched the old root files that moved to `apps/michal-ai`. Then move the folder in one commit
with no edits, so history follows:

```bash
git mv halmic/site/*  apps/halmic/     # site/ becomes the app root (build.mjs, serve.mjs, src/, public/, package.json)
git mv halmic/brand   apps/halmic/brand
git mv halmic/content apps/halmic/content
git mv halmic/scripts apps/halmic/scripts
git mv halmic/docs    apps/halmic/docs
git mv -f halmic/README.md apps/halmic/README.md   # replaces the placeholder README
git commit -m "Move halmic into apps/halmic"
```

Do the merge commit and the move as two commits (merge first, move second).

## 2. Join the workspace

`halmic/site/package.json` is currently `halmic-site-prototype`. Edit it (second commit, after the move):

- `"name": "@space/halmic"`; keep `"private": true`, `"type": "module"`.
- Scripts the root expects: `dev` (= today's `start`), `build` (= `node build.mjs`), `deploy`, plus `lint`/`test`/`typecheck`
  if it gains any (the root scripts use `--if-present`).
- Add `wrangler` as a devDependency (same range as the portfolio).
- `build.mjs` and `serve.mjs` read `../brand` and `../content` relative to `site/`. After the move those are
  `./brand` and `./content`. Fix the paths in `build.mjs` (`read('../brand/...')`, `read('../content/...')`),
  in `sync:youtube` (`node ./scripts/sync-youtube.mjs`) and in `scripts/*.mjs`.
- Run `npm install` at the repo root so the lockfile gains the workspace.

## 3. Its own Worker (different name)

Create `apps/halmic/wrangler.jsonc`:

```jsonc
{
  "name": "halmic",
  "compatibility_date": "2026-10-01",
  "assets": { "directory": "./public", "not_found_handling": "404-page" }
}
```

No Durable Objects, no service bindings, no reference to the Worker `space`. `deploy` = `node build.mjs && wrangler deploy`.
Point the `halmic.com` custom domain at this Worker (owner action in the Cloudflare dashboard). The domain currently 302s
to the portfolio; remove that redirect at launch (see `apps/halmic/docs/discovery.md`).

## 4. Keep the two sites apart

- No imports from `apps/michal-ai` in `apps/halmic` or the reverse. Shared code goes through `packages/*` only, and only
  code without copy, names, URLs, analytics ids or fonts that identify one owner.
- `apps/halmic/content/identity-denylist.txt` is the sync script's own copy of the patterns; `scripts/check-identity.mjs`
  exempts exactly that file. The root `scripts/identity-denylist.txt` is the source of truth for the CI check.
- Delete the "Internal notes" section of `apps/halmic/docs/discovery.md` before this repository is made public (the
  check skips `docs/`, so it will not catch it).
- `npm run check:identity` must pass on the merged tree. The portfolio side is a soft warning only.

## 5. Verify

```bash
rm -rf node_modules apps/*/node_modules && npm ci
npm run build:halmic && npm run check:identity
(cd apps/halmic && npx wrangler deploy --dry-run)   # Worker name must be `halmic`
npm run build:michal                                  # unchanged
```

Add `apps/halmic/**` screenshots to the PR body from the scratchpad `halmic2-*` files.
