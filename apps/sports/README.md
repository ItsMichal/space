# sports.halmic.com

A private host for the browser build of the game, behind one shared passkey. It is a Cloudflare Worker (`halmic-sports`)
that reads the game files from an R2 bucket. Separate from the `halmic` and `space` Workers: its own deploy job, its own
files. The game files are not in this repo.

## What it does

- Serves what the game repo's `scripts/serve-web.mjs` serves for `build/web`: the page files by path, and
  `/chunks/<hash>/<i>` from the precompressed objects `z/<hash>.<i>.br|gz` with `Content-Encoding` (brotli when the browser
  accepts it, else gzip; never recompressed). The raw wasm, data and disc files are not uploaded: the page only reads them as
  chunks.
- Every path except `/gate` (and `/robots.txt`, which says `Disallow: /`) needs the cookie from a correct passkey. The cookie
  is an HMAC-signed `HttpOnly; Secure; SameSite=Lax` value that lasts 30 days. It is keyed with the passkey, so changing the
  passkey signs everyone out. All responses carry `X-Robots-Tag: noindex, nofollow`.
- Without the `SPORTS_PASSKEY` secret every request answers 503.
- Dev-only endpoints of the local server (`/__stats`, the debug log POST) answer 404. `/lobby` and `/netplay` (online play)
  answer 501: not built here yet.

## One-time setup (owner)

1. Create the R2 bucket `halmic-sports` (dashboard: R2, Create bucket; or `npx wrangler r2 bucket create halmic-sports`).
2. Set the passkey (type it at the prompt; it is never in git or in CI):

   ```bash
   cd apps/sports && npx wrangler secret put SPORTS_PASSKEY
   ```

   The first `secret put` before the Worker exists asks to create it; say yes. To change the passkey, run it again.
3. Upload a game build from the Mac that has it, in the game repo (`memesports-native`, branch `sports-publish`):

   ```bash
   node scripts/publish-r2.mjs build/web
   ```

   Reruns upload only what changed. `--dry-run` shows the plan.
4. Deploy: merge to `main` with repository variable `DEPLOY_SPORTS=true` (the job is dormant without it, so a merge before
   the bucket exists does not fail), or run `gh workflow run Deploy -f app=sports`. Never `wrangler deploy` locally.

The CI token needs, in addition to what the `halmic` deploy already uses, nothing more if the bucket exists: Workers Scripts
Edit and the halmic.com zone permissions for custom domains cover the binding and `sports.halmic.com`. If the deploy fails
with an R2 permission error, add Account, Workers R2 Storage, Edit to the token.

## Develop

```bash
npm test -w @space/sports          # unit tests (gate, cookie, chunk headers, paths)
cd apps/sports && printf 'SPORTS_PASSKEY=anything-local\n' > .dev.vars   # gitignored
npx wrangler dev --persist-to .wrangler/state                      # local R2 simulator
node <game repo>/scripts/publish-r2.mjs <build/web> --local --persist-to .wrangler/state
```

## Traps

- `workerd` rejects non-handler named exports from `worker/index.js` (a string constant exported there stops the Worker
  from starting). Keep helpers in `auth.js` and `gate-page.js`.
- The gate page cannot use the site fonts (they would sit behind the gate); it uses system fonts and inline CSS under its
  own CSP.
- The bucket's `.publish-state.json` is the upload script's bookkeeping. Paths with a dot-segment are never served.
- Online play (lobby, signalling) would be a Durable Object or a second Worker; see the notes in the game repo's
  `docs/sports-host.md`.
