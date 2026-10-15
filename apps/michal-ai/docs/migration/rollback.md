# Rollback

The Worker name (`space`), its custom domains and routes, the Durable Object classes, bindings and migration tags (`v1`, `v2`) and the vars are
unchanged by the migration, so production data (reactions, views) is untouched in either direction.

**Fastest (seconds, no build):** Cloudflare keeps previous Worker versions.

```bash
cd apps/michal-ai
npx wrangler deployments list     # find the version that was live before the migration
npx wrangler rollback <version-id>
```

Version metadata includes the assets that version uploaded, so the old site comes back with it.

**Through git (rebuilds the old Next + OpenNext site):**

1. `git revert -m 1 <merge commit of the migration PR>` on `main` and open a PR (never push to `main` directly), or
   `git checkout ffbcb28 -- apps/michal-ai packages .github package.json package-lock.json scripts` on a branch if the revert conflicts with later work.
2. Merge it; the Deploy workflow runs `npm run deploy:michal`, which at that commit is `opennextjs-cloudflare build` then deploy.
3. If posts or components changed after the migration, expect conflicts in `app/` (the Next pages live in `app/**/page.tsx`; the new routes
   reuse most of them) and resolve in favour of the newer content.

The pre-migration commit is `ffbcb28` (merge of PR #58). `docs/migration/baseline.md` describes how that build was produced locally, including
the `next/font/google` workaround needed in a network-restricted sandbox.
