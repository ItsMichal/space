# Content repo and the writing editor

Posts and post media live in the private repo **ItsMichal/space-content**, together with the writing editor served at
write.michal.ai. This repo (public) keeps the site, the structured data in `apps/michal-ai/content/*.ts`, and the one
definition of what content may contain. The editor's threat model and the owner setup checklist are in the space-content
`README.md`; this page covers the space side.

## What lives where

| | ItsMichal/space (public) | ItsMichal/space-content (private) |
| --- | --- | --- |
| Posts | `content/posts/*.md`, until the cutover below; then filled by `content:pull` | `posts/*.md` |
| Post media | `public/media/<slug>/`, same | `media/<slug>/` |
| Site media | `public/media/about/`, `_v`, `_og` (generated), `CREDITS.md` | none |
| Structured data | `content/*.ts`, `content/redirects.json` | none |
| Content rules | `lib/content/rules.mjs`, `scripts/content/validate.mjs` | runs them from a checkout of space main |
| Editor | none | `editor/` (Worker `write` plus the SPA) |

## The content rules, in three places

`apps/michal-ai/lib/content/rules.mjs` is the only definition: front matter schema and limits, the strict slug pattern, no
em or en dashes, link and image schemes (http, https, mailto, site paths), the embed host allowlist, the directive and
attribute allowlist, media types by magic bytes (no SVG), and safe front matter parsing (gray-matter's `---js` engine
evaluates code, so `SAFE_MATTER` turns every code engine into an error). It runs:

1. **Here, at build time.** `prebuild` starts with `node scripts/content/validate.mjs`, so a bad post fails the build.
   `npm run content:check` runs it on its own.
2. **In space-content pull request CI.** Its `validate` job checks out this repo's `main` and runs
   `scripts/content/validate.mjs --posts posts --media media`. The rules come from main here, so a pull request there
   cannot loosen them.
3. **In the editor**, before it commits or opens a pull request. The editor is built on top of this app (below), so it
   imports the same module.

The renderer is the backstop: `lib/content/render.tsx` never passes raw HTML (`allowDangerousHtml: false`, no
`rehype-raw`), and `lib/content/safety.ts` removes anything that slips through (unknown elements and directives, event
handler and style attributes, unsafe `href` and `src`). JSON-LD text is escaped (`jsonLdText` in
`components/seo/JsonLd.tsx`). Hostile fixtures: `lib/content/__tests__/hostile.test.ts`.

## How the editor shares site code: the overlay build

space-content does not copy or vendor site code. Its CI checks out this repo's `main` into `.site`, runs `npm ci` there,
lays `editor/{app,components,lib,write}` over `.site/apps/michal-ai/`, pulls its own posts into it, and then typechecks,
tests, builds and deploys the editor from there (`editor/scripts/with-site.sh` in space-content). So:

- every `@/` import and relative import in the editor resolves to the real site code, with one lockfile;
- the editor's npm dependencies (Tiptap, lowlight and friends) stay in `apps/michal-ai/package.json` here. They are dev
  dependencies and nothing in the public build imports them;
- `tsconfig.json` excludes `write/worker` and `write/dist`, `vitest.config.ts` includes `write/**/*.test.ts` and
  `eslint.config.mjs` ignores `write/dist`; those entries exist for the overlay;
- `lib/rr/no-editor.test.ts` walks the import graph of the production build (root, production routes, the Worker) and
  fails if it reaches any editor folder, with or without the overlay; `lib/rr/routes.test.ts` asserts there is no `/write`
  or `/api` route in any environment.

Changing a site module the editor uses (for example `lib/content/serialize.ts` or `lib/content/rules.mjs`) can break the
editor build in space-content. Its CI runs on every editor change; run it there after such a change.

## Pulling content

```
npm run content:pull -w @space/michal-ai                       # clones or updates apps/michal-ai/.content with your git credentials
CONTENT_DIR=../space-content npm run content:pull -w @space/michal-ai   # or use a checkout you already have
```

It validates the checkout first, then makes `content/posts/*.md` exactly the content repo's `posts/`, and replaces every
post folder in `public/media/` with the content repo's copy. It never touches `about/`, `_v/`, `_og/` or `CREDITS.md`, and
it refuses symlinks. `.content/` is gitignored.

In CI and deploy, `.github/actions/content` checks space-content out with the read-only deploy key in secret
`CONTENT_DEPLOY_KEY` (no persisted credentials) and runs `content:pull`. Without the secret it prints a notice and the build
uses the content in this repo, which is the state until the cutover. Pull requests from forks never see the secret.

## Deploys

- A push to space-content `main` that touches `posts/**` or `media/**` dispatches this repo's `Deploy` workflow with
  `app=michal` (space-content workflow `trigger-site-deploy.yml`, token `SPACE_DISPATCH_TOKEN`: a fine-grained PAT with
  Actions read and write on ItsMichal/space only). The deploy job's concurrency group queues it behind a running deploy.
- Pull requests in either repo never deploy.
- The editor Worker `write` is deployed by space-content (`deploy-editor.yml`), never from here.

## Cutover order

1. Owner completes the setup checklist in the space-content `README.md` (repo seeded, deploy key, `CONTENT_DEPLOY_KEY` here).
2. Merge this change. Builds still use the content in this repo, now validated by `prebuild`.
3. With `CONTENT_DEPLOY_KEY` set, the next CI build and deploy pull from space-content. Since the seed is a copy of this
   repo's posts and media, the output is identical; check the deploy summary and the parity smoke test.
4. Freeze edits to `content/posts` and post media here. From now on posts change only through space-content.
5. Follow-up PR here (not part of this change):
   - delete `content/posts/*.md` and `public/media/<post slug>/` from this repo and gitignore them;
   - make the `checks` action run `content:pull` before tests (tests read `content/posts`), or point those tests at
     fixtures (`content.test`, `embeds.test`, `mentions.test`, `presence.test`, the live-slugs drift test);
   - stop committing generated files that depend on posts (`lib/presence/slugs.generated.ts`,
     `content/embed-status.json`, `lib/media/manifest.json`) and generate them in `prebuild` only;
   - make `content:pull` required in CI (fail instead of the notice when the key is missing on `main`).
