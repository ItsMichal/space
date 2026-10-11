# PR plan

A stack, merged in order. Each PR targets the previous branch until its parent merges, then retarget to `main`.
Screenshot folder: `/private/tmp/claude-501/-Users-michal-Desktop-dev-space/ec70ad79-12cb-4462-b58a-1b95b9bae29e/scratchpad/shots/`
(attach by drag-and-drop; files are not committed).

```
main <- overhaul <- release-2 <- monorepo <- halmic-site
                 \- medium-import (optional)   \- content-edits (optional)
```

Branch sizes: overhaul 41 commits over main; release-2 87 over overhaul; monorepo 5 over release-2; halmic-site 6.
`medium-import` (6 commits, branched from the overhaul tip `d30cbd2`) and `content-edits` (7 commits, branched from an
earlier overhaul commit `78e3cfc`) only touch `content/posts/**`, `public/media/**` (plus importer script, snapshots and a package.json dependency for medium).
Both predate release-2 and the monorepo move: merge `release-2` (or `monorepo`) into them before opening; git rename
detection carries `content/posts/*.md` to `apps/michal-ai/content/posts/*.md`.

Review before pushing anywhere public (information for the owner, not blockers):
see "Review before pushing to a public repo" at the end.

---

## PR 1: `overhaul` -> `main`

**Title:** Overhaul: Next 15 on Cloudflare, in-sourced content, new design

**Body**

(see `scratchpad/pr1-overhaul.md`, reproduced here)

## Summary

The overhaul that is live today at https://space.michalai.workers.dev.

- **Platform:** Next.js 15 / React 19, deployed to Cloudflare Workers via OpenNext (was Vercel). Fully static: prerendered pages are served from Workers static assets.
- **Content in the repo:** all Notion projects and posts exported to `content/posts/*.md` with media in `public/media/`; the Notion integration is removed. A re-runnable `scripts/export-notion.mjs` is kept.
- **Writing tool:** a local-only WYSIWYG editor at `/write` (dev only, absent from production builds) that saves Markdown and media into the repo, with round-trip tests.
- **Design:** warm paper palette, light landing page (dark only on reading pages), new type, project showcase ordered best-first with responsive AVIF/WebP images, lightbox.
- **Structure:** Project Mountaintop's progress log lives under the project (`/projects/project-mountaintop/<entry>`); `/writing` is the blog. Old URLs 308-redirect.
- **SEO:** canonical URLs, Open Graph/Twitter, JSON-LD, RSS + JSON feeds, generated OG images, sitemap from content.
- **Copy:** name spelled Michał; About and experience taken from LinkedIn; favicon and app icons fixed.

## How to test

```bash
npm ci
npm test && npx tsc --noEmit && npm run lint
npm run preview   # builds and runs the real Worker locally
```

Check `/`, `/projects`, a project page, a Mountaintop log entry, `/writing`, `/feed.xml`, `/sitemap.xml`, and that `/writing/mountaintop-week-5-6-spaaaaace` and `/projects/barcode-game` redirect.

## Risks

- Canonical URLs on this branch still point at `michal.us`; PR 2 moves them to `michal.ai`.
- The presence Durable Object is deployed but unused by the client on this branch.
- Deploy is manual: `npm run deploy`.

## Screenshots

`integ-ship-home-1280.png`, `integ-ship-home-375.png`, `integ-ship-projects-1280.png`, `integ-ship-log-dark-1280.png`, `editor-light-article.png`, `editor-dark-slash-menu.png`

## Checklist

- [ ] `npm test`, `tsc --noEmit`, `npm run lint` pass
- [ ] `npm run preview` serves every route; dev-only routes (`/write`, `/api/write`) 404
- [ ] Redirects return 308
- [ ] Review-before-public list read (below)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 2: `release-2` -> `overhaul`

**Title:** Design v2, micro-UI, Liquid Glass, michal.ai canonical

**Body**

## Summary

The next release of the portfolio, stacked on the overhaul PR.

- **Design v2:** Michelangelus display serif (one-file swap in `app/fonts/display.ts`), warm floral backdrop from real photographs with quiet zones around text, homepage images with a soft watercolor edge, a rebalanced featured block.
- **Rotating work line** in the hero ("I've built ..."): each phrase links to its project, driven by a `hook` field in post frontmatter; pausable, swipeable, keyboard-steppable, all links present in static HTML.
- **Micro-UI kit** (`components/ui`): scrubbable timeline (experience, Mountaintop log, Starlink launches), status pill in the nav, gallery with page control, segmented filter on `/projects`, fact rows, disclosure, reading table of contents.
- **Liquid Glass** (`components/glass`): a web port of Apple's API: merging containers, morphing, glass buttons, fold-out phone menu. Refraction in Chromium, frosted fallback elsewhere.
- **Motion:** shared spring utility and a small handcrafted-motion toolkit (`lib/motion`); hand-drawn link underline, settling title, ink press. Reduced motion respected; no scroll interception.
- **Domain:** `https://michal.ai` is canonical; `michal.us` and `www.michal.ai` 308 to it in the Worker; `*.workers.dev` is `noindex`.
- **Copy:** role and About updated; "0 to 1" tagline removed.

## How to test

```bash
npm ci
npm test && npx tsc --noEmit && npx tsc -p worker --noEmit && npm run lint
npm run preview
```

Hero work line (rotate, hover, swipe on touch), phone menu, `/projects` filters, the Starlink timeline, a log entry in dark mode, reduced motion.

## Risks

- Verified locally in headless Chrome only; not checked in Safari or on a real phone.
- The homepage cherry blossom is a CC BY 4.0 photo credited in the footer; hydrangea and daylily are the owner's photos.
- `app/fonts/Michelangelus-*.woff2` are included at the owner's decision; swap in `app/fonts/display.ts` if needed.
- Domain cutover (DNS / custom domain on the Worker) is a separate owner action in Cloudflare.

## Screenshots

`r2-entry-top-1280.png`, `r2-entry-top-375.png` (if present), `glass-home-desktop-light.jpg`, `glass-mobile-375-fold-menu-open-svg-light.jpg`, `craft-tendril-1280.png`, `craft-timeline-375.png`, `integ-ship-starlink-1280.png`, `integ-ship-home-dark-375.png`

## Checklist

- [ ] Tests, typecheck (app and worker), lint
- [ ] `npm run preview`: `michal.us` / `www.michal.ai` hosts 308 to michal.ai; `workers.dev` responses carry noindex
- [ ] Font licence and photo credits confirmed
- [ ] Review-before-public list read (below)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 3: `monorepo` -> `release-2`

**Title:** Monorepo: apps/michal-ai, packages (motion, tokens, config), CI, identity check

**Body**

## Summary

Turns the repo into an npm-workspaces monorepo without changing what the portfolio ships.

Review commit by commit, the first two are mechanical:

1. `Move portfolio into apps/michal-ai`: **pure `git mv`, 383 renames, 0 content changes.** Skim `git show --stat -M`; nothing to review line by line.
2. `Move lib/motion into packages/motion/src`: rename only.
3. `Wire npm workspaces, @space/motion, @space/tokens, @space/config`: the real diff (import rewrites `@/lib/motion/x` -> `@space/motion/x`, root `package.json`, tsconfig/eslint extend `@space/config`, tokens generator moved to `@space/tokens`, scripts `chdir` to the app root, unused `@react-spring/web` and `@use-gesture/react` removed, `.gitignore` anchors updated, one lockfile at the root with every other version unchanged).
4. `Identity check, CI, README, apps/halmic placeholder, halmic merge notes`.
5. Docs/fixups.

New: `.github/workflows/ci.yml` (typecheck, lint, test, identity check; per-app build with path filters; **no deploy**), `scripts/check-identity.mjs`, `docs/monorepo/*`.

## How to test

```bash
rm -rf node_modules apps/*/node_modules && npm ci
npm run typecheck && npm run lint && npm test && npm run check:identity
npm run build:michal
cd apps/michal-ai && npx opennextjs-cloudflare build && npx wrangler deploy --dry-run
```

Verified: route table identical to `release-2`'s build; every prerendered `.html`, feed, sitemap, robots and manifest
byte-identical apart from asset hashes and the build id; local Worker sweep (`wrangler dev`) matches (200s, 308 redirects,
404 for `/write`, `/api/write`, `/motion`); `wrangler deploy --dry-run` shows Worker `space` with the same bindings
(PRESENCE Durable Object, WORKER_SELF_REFERENCE, ASSETS).

## Risks

- Cloudflare Workers Builds (if enabled for the `space` Worker) must be pointed at `apps/michal-ai` with the build command in the README before merging, or the next push will fail to build. Deploys are otherwise unaffected.
- Any open branch is re-based by git rename detection; branches with conflicts in moved files need a normal merge of this branch.
- The `@/` alias and every `process.cwd()` assume the app root; npm `-w`, Next, vitest and OpenNext all start there.

## Screenshots

None needed (no visual change). Optionally attach the route-table diff (empty).

## Checklist

- [ ] Commit 1 is rename-only (`git show -M --stat` shows 0 insertions/deletions)
- [ ] CI green
- [ ] Workers Builds root directory updated (owner)
- [ ] README read: what lives where, how to add a shared package

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 4: `halmic-site` -> `monorepo`

**Title:** halmic.com: static site, brand kit, own Worker `halmic`

**Body**

## Summary

Adds the halmic site as `apps/halmic`, deployable on its own as Worker `halmic`. Steps used: `docs/monorepo/halmic-merge.md`
(merge, then a rename-only move, then package/wrangler wiring).

- Static site (`build.mjs`, `src/`, `public/`), two directions (bold, calm), video grid synced from YouTube, JSON-LD for the handle.
- Brand kit (wordmark, h-mark, spacing proofs) and design/technical docs.
- No shared runtime code with the portfolio; `npm run check:identity` guards that nothing shipped contains the owner's real name.

## How to test

```bash
npm ci && npm run build:halmic && npm run check:identity
npm run dev:halmic
cd apps/halmic && npx wrangler deploy --dry-run   # name must be "halmic"
```

## Risks

- `halmic.com` currently 302s to the portfolio; that redirect must be removed at launch.
- Held video entries (`content/videos.held.json`) must be reviewed before publishing.
- `apps/halmic/docs/discovery.md` has an "Internal notes" section that links the handle to the owner; delete it if the repo is public.

## Screenshots

`halmic2-bold-live-1280.png`, `halmic2-bold-live-375.png`, `halmic2-bold-design-1280.png`, `halmic2-bold-games-1280.png`, `halmic-calm-live-1280.png`

## Checklist

- [ ] Identity check passes
- [ ] Worker name `halmic`, no bindings to `space`
- [ ] Custom domain and redirect removal planned

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Optional content PRs

### PR 5a: `medium-import` -> `release-2` (after merging release-2 or monorepo into it)

**Title:** Import Medium articles as drafts

**Body**

## Summary

Adds a Medium importer (`scripts/`, meta, dependency), the source snapshots, and the imported articles as **drafts**
(`draft: true`, so they are not built or listed) with their media (13 articles, about 220 files under `public/media/`). UTC publish dates; alt-less lead images stay in the body.

## How to test

`npm ci && npm test` (content tests validate frontmatter and media references); `npm run dev:michal` and read a draft via the editor.

## Risks

- Large binary diff (media). Drafts do not ship, but the files are in the repo history permanently.
- The source snapshots in `scripts/medium-src/` come from halmic.medium.com and show the Medium byline; these articles land in the portfolio (real-name site), never in `apps/halmic`.
- `package.json` / `package-lock.json` change on this branch; after the monorepo move they conflict by path, so re-apply the importer dependency in `apps/michal-ai/package.json` and regenerate the lockfile with `npm install` at the root.
- Importer script and the `docs/content-review/medium-import.json` report move under `apps/michal-ai/` by rename detection.

## Screenshots

None.

## Checklist

- [ ] Content tests pass
- [ ] Decide per draft: publish, keep draft, or delete

🤖 Generated with [Claude Code](https://claude.com/claude-code)

### PR 5b: `content-edits` -> `release-2` (after merging release-2 or monorepo into it)

**Title:** Content edits: clearer titles, openings and cross-links for seven project pages

**Body**

## Summary

Edits seven project posts for search and clarity (Starlink general/order-flow/product-launch, F1 commentator, Frogchamp, iSAT dashboard, JIA web app): titles and openings say what each thing is, role and dates up front, grammar, descriptive link text, cross-links between related posts. Content only.

## How to test

`npm test` (content tests), `npm run build:michal`, read the seven pages. Note: titles change, so check `/sitemap.xml` and feeds; slugs are unchanged so no redirects are needed.

## Risks

- Facts were edited from the existing copy and the owner's notes; read each page once for claims about the owner's role.

## Screenshots

None.

## Checklist

- [ ] Each page read by the owner
- [ ] Tests green

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Review before pushing to a public repo (information, not blockers)

The tie between the two identities and the real-name commit history is accepted. These files are the owner's call:

| Path (on `release-2` / `monorepo`) | Why |
| --- | --- |
| `apps/michal-ai/app/fonts/Michelangelus-Regular.woff2`, `Michelangelus-Italic.woff2` | Display typeface; licence terms restrict redistribution. Included at the owner's earlier decision; a public repo redistributes them. Swap via `app/fonts/display.ts`. |
| `apps/michal-ai/assets-src/portrait.jpg` | The owner's source portrait. |
| `apps/michal-ai/assets-src/botanical/own/*.jpg` (cherry-blossom, daylily, hydrangea) and `.../own/preview/*` | The owner's personal photos (full-size originals; shipped variants are already public). |
| `apps/michal-ai/assets-src/botanical/*.jpg`, `botanical-photo/preview/*`, `botanical/wikimedia/*` | Third-party plates (public domain / CC BY); credits are in the site footer. Keep attribution. |
| `apps/michal-ai/docs/content-review/linkedin-source.md` | Text of the owner's LinkedIn profile. |
| `apps/michal-ai/public/BodzianowskiResume.pdf` | Already served by the live site; listed so it is a conscious choice. |
| `halmic-site`: `halmic/docs/discovery.md` (the "Internal notes" section and the INTERNAL banner) | Research trail; says the handle is a persona and notes the Medium byline shows his name. |
| `halmic-site`: `halmic/content/identity-denylist.txt` | Contains the real-name patterns by design. |

Secrets: none found. `git grep` for keys/tokens/passwords/PEM across all tracked files returns only design-token wording; no `.dev.vars`, `.env*` or `*.pem` is tracked (all are in `.gitignore`).
