# AGENTS.md

Guide for AI coding agents (and humans) working in this repo. Tool-agnostic. Read this first, then the app guide for the
area you touch: [`apps/halmic/AGENTS.md`](apps/halmic/AGENTS.md), [`apps/michal-ai/AGENTS.md`](apps/michal-ai/AGENTS.md).
Human-oriented overview and deploy details: [`README.md`](README.md).

## What this repo is

Two independent sites in one npm-workspaces monorepo (Node 22, one lockfile at the root, no Turborepo).

| Path | What | Live | Worker |
| --- | --- | --- | --- |
| `apps/michal-ai` | The owner's real-name portfolio. Next.js App Router on Cloudflare Workers via OpenNext. | michal.ai | `space` |
| `apps/halmic` | A persona site. Zero-dependency static build plus one small Worker. | halmic.com | `halmic` |
| `packages/*` | Shared code: `motion`, `tokens`, `config`, `crosslinks`. | n/a | n/a |

- The apps never import from each other. Shared code goes through `packages/*` only, and only code that carries no copy,
  names, URLs or analytics ids.
- `packages/crosslinks` defines the one sanctioned link between the sites: the logo switcher and the paired-content links
  (`src/pairs.mjs`). See "Identity rule" below.
- `docs/monorepo/` is history (how the repo was assembled). It is not a description of the current state.

## Commands (run at the repo root)

```bash
npm install                 # after pulling, whenever a workspace package was added (see below)
npm run dev:michal          # portfolio dev server (predev builds image variants)
npm run dev:halmic          # builds, then serves http://localhost:4310/
npm run build:michal        # next build
npm run build:halmic        # regenerates apps/halmic/public (tracked output)
npm run check               # typecheck + lint + test + check:identity + check:dashes + check:slugs
npm run check:identity      # identity guard (hard for halmic, soft for the portfolio)
npm run check:dashes        # no em/en dashes in what the portfolio ships
npm run check:slugs         # portfolio post slugs and redirects
npm test -w @space/halmic   # worker unit tests, link/markup check, social-card check
```

- `npm run check` is the local equivalent of the CI `checks` job, plus the dash and slug guards. CI (`.github/actions/checks`)
  runs typecheck, lint, test and `check:identity`.
- A missing `@space/crosslinks` link (`ERR_MODULE_NOT_FOUND` from `npm run build:halmic`) means you need `npm install` at
  the root: a new workspace package is not linked until you do.
- Deploy scripts (`deploy:michal`, `deploy:halmic`) exist but agents do not run them. See "Shipping".

## Shipping

- Work on a branch, open a PR against `main`, merge. Never push to `main` directly.
- The GitHub Actions `Deploy` workflow deploys whichever app changed. It uses the repository secret
  `CLOUDFLARE_API_TOKEN` and the variables `CLOUDFLARE_ACCOUNT_ID`, `DEPLOY_HALMIC=true`, `HALMIC_URL`. Do not ask the owner to
  run `wrangler deploy` locally.
- Redeploy without a code change: `gh workflow run Deploy -f app=halmic` (or `michal`, `both`).
- Auto-merge is disabled on the repo. Merge with `gh pr merge <n> --merge`.
- After a merge, watch the Deploy run (`gh run list --workflow Deploy`, `gh run watch <id>`) and check the live site.
  Both deploy jobs run a smoke test; a green run still deserves a look at the page you changed.
- Merging your own halmic PRs is pre-approved when checks are green and the diff is what was asked for. For anything else,
  stop at an open PR and say so.
- If Workers Builds is also connected to a Worker, every merge deploys twice. Disconnect it (owner action).
- Rollback and the one-time Cloudflare/GitHub setup are in the root README.

## Commits and PRs

- No AI attribution anywhere: no `Co-Authored-By` trailers, no "Generated with ..." lines, in commits or PR bodies.
- Message style follows the history (`git log --oneline`): halmic work uses `halmic: <short plain sentence>`; portfolio work
  is a plain description (`michal.ai: ...` or a topic prefix such as `Share cards: ...`); docs use `Docs: ...`.
- Stage by explicit path. Never `git add -A` or `git add .` at the root: the root has unrelated untracked `lib/` and
  `public/` directories that must not be committed.
- Other sessions may be working here at the same time (open PRs on `apps/michal-ai`). Run `git fetch` before branching, branch
  from `origin/main`, expect `main` to move, and keep diffs local to your area. Do not touch an app another PR is changing
  unless asked.
- Commit WIP early and often on your branch; a long task with no commits is a risk.
- Do not rewrite or force-push history that other people may have pulled.

## Identity rule (read before touching halmic content or media)

halmic is a persona. The owner's real name (in any form), initials and portfolio domain are not PRINTED anywhere halmic.com
ships: page text, `<meta>`, JSON-LD, alt text, file names, and the pixels of images and video (credits, HUD name bars,
overlays, usernames).

- It is a preference, not secrecy. Linking OUT to pages that show his name (Medium, YouTube, teammates' LinkedIn, his own
  posts) is fine, as long as the URL itself does not contain the name or the portfolio domain.
- Usernames and handles that contain his first name count as printing it.
- The sanctioned exceptions are encoded in code, not decided ad hoc. `scripts/identity-lib.mjs` allows exactly: the logo
  switcher link and label (twice per built halmic HTML page: header and footer), one link on a page to its paired michal.ai
  piece (from `packages/crosslinks/src/pairs.mjs`), and outbound links to the owner's own X posts in the single status-URL
  form defined by the approved X status URL pattern in that file. Any second mention, other URL, other page or other
  spelling fails.
- `npm run check:identity` is a hard CI gate for `apps/halmic` (source, content, public files, build output; directories named
  `docs` and files named `README*` are skipped, but `apps/halmic/AGENTS.md` IS scanned, so it must stay clean). For the portfolio it only warns when shipped copy mentions the
  persona handle outside `scripts/identity-allowlist.txt`.
- Never print, quote, paste or summarise the deny list (`scripts/identity-denylist.txt`,
  `apps/halmic/content/identity-denylist.txt`) in docs, commits, PR text, logs or chat. Never weaken it. Add a narrowly scoped
  allowance in `identity-lib.mjs` only when the owner explicitly says to.
- When shipping media (thumbnails, preview loops, the hero reel, screenshots, post images), LOOK at the frames. Several FIFA
  videos show a surname in a HUD card, the Special Force films have name credits, some Twitch overlays show a handle.
  Text checks cannot see pixels.

## Guards that lint prose and content

- `check:dashes`: the portfolio (`apps/michal-ai` app, components, lib, content, worker, public) must contain no em dash or en
  dash, literal or escaped. Use a middle dot as separator and "to" or a hyphen for ranges. Exceptions live in
  `scripts/dash-allowlist.txt`. Keep new docs dash-free too.
- `check:slugs`: post slugs are lowercase ASCII words joined by single hyphens, at most 60 characters, unique; every entry in
  `content/redirects.json` goes straight to a live post.

## Agent environment notes

These describe the sandboxed agent harness used on this repo; they may not apply to other tools.

- Commands that write `.git/config`, push, or call `gh` need the sandbox disabled (keychain and TLS are outside it). So do
  binding local ports (dev servers, `wrangler dev`) and headless Chrome.
- Node's `fetch` may not resolve external hosts inside the sandbox while `curl` with an allowed domain can. Scripts that use
  `mktemp` (such as `scripts/smoke.sh`) fail inside it.
- Production deploys (`wrangler deploy`) and DNS or domain changes are blocked for agents by policy. Deploy by merging; hand
  DNS steps to the owner.
- Agents do not read or type secrets (Twitch client secret, API tokens). The owner runs `wrangler secret put` and adds GitHub
  secrets.
- Prefix shell commands with `rtk` (installed via Homebrew) where it has a subcommand, for compact output. Tell subagents too.
- Delegation convention: the lead agent plans and reviews; implementation goes to cheaper subagents with exact briefs, who
  commit WIP early. Agents that share one browser, dev-server port or working tree must be kept off the shared resource at the
  same time (give each its own worktree, port and browser tab).
- Domains: halmic.com is registered at Porkbun with nameservers at Cloudflare (the zone is in the owner's Cloudflare
  account). Custom domains are attached through `routes` in `apps/halmic/wrangler.jsonc`. `workers_dev` and preview URLs are
  off for halmic because its workers.dev address would expose the account's portfolio name.

## Where things live

- Root `scripts/`: `check-identity.mjs` + `identity-lib.mjs` (guard), `check-dashes.mjs`, `check-slugs.mjs`, `smoke.sh`
  (post-deploy curl checks), allow/deny lists.
- `.github/workflows/ci.yml` verifies PRs (path-filtered builds plus `wrangler deploy --dry-run`); `deploy.yml` deploys.
  Shared steps are in `.github/actions/` (`setup`, `checks`, `media-cache`).
- `packages/config` shared tsconfig/eslint/prettier bases; `packages/tokens` token generator; `packages/motion` spring and
  stroke maths; `packages/crosslinks` the switcher, marks and pair map (plain ESM, tested with `npm test -w @space/crosslinks`).
- `.claude/launch.json` is gitignored and local. It has `halmic` (port 4310) and `halmic-worker` (`wrangler dev` on 8788) entries
  for tools that read it.
- To pair another piece of content across the sites, add a row to `packages/crosslinks/src/pairs.mjs`; its test proves both
  targets exist and the michal.ai one is live and not a redirect.

## Working style

- Read before you write. Verify claims against the repo, not against a brief or old docs.
- Keep changes narrow. No drive-by refactors, no new dependencies in `apps/halmic` (it has none by design).
- Do not hand-edit generated files (see the halmic guide). Do not add comments or docs that restate the code.
- Write each fact in one place and link to it. READMEs are for humans (what, how to run/build/deploy, where things live);
  this file and the app `AGENTS.md` files are for rules and traps.
- If you learn a trap the hard way, add it to the right AGENTS.md in the same PR.
