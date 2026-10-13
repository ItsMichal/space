# Parity harness

Proves the React Router migration changes nothing a visitor or crawler can observe. Needs Google Chrome and permission to use
localhost (bind and connect). The golden reference is the Next build of `origin/main` before the migration.

1. Golden: build `main` (`npm run build -w @space/michal-ai`; if `next/font/google` cannot reach Google, see `docs/migration/baseline.md`),
   `npx next start -p 4001 -H 127.0.0.1`, then
   - `node scripts/parity/snapshot.mjs http://127.0.0.1:4001 .parity/golden`
   - `node scripts/parity/shots.mjs http://127.0.0.1:4001 .parity/golden-shots`
   - `node scripts/parity/behave.mjs http://127.0.0.1:4001 .parity/golden-behave.json`
2. Candidate: serve the new build (for example `wrangler dev` on 4002) and run the same three into `.parity/new*`
   (add `--worker` to snapshot to include `/api/live/*` and the Starlink binary).
3. Compare:
   - `node scripts/parity/diff.mjs .parity/golden .parity/new --out .parity/report.md --allow scripts/parity/allow.json`
   - `node scripts/parity/shotdiff.mjs .parity/golden-shots .parity/new-shots --out .parity/shot-diffs`

`.parity/` is git-ignored. `snapshot` covers the sitemap pages, feeds, robots, manifest, icons, share images, the 59 redirect
sources, trailing-slash and 404 probes, and status/type/hash of every same-origin reference the pages make. `allow.json` lists
intentional differences (`{ "url": regex, "field": prefix, "why": text }`).
