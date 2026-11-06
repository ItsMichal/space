# space

[![CI](https://github.com/ItsMichal/space/actions/workflows/ci.yml/badge.svg)](https://github.com/ItsMichal/space/actions/workflows/ci.yml)
[![Deploy](https://github.com/ItsMichal/space/actions/workflows/deploy.yml/badge.svg)](https://github.com/ItsMichal/space/actions/workflows/deploy.yml)

The source for two personal websites and the small packages they share:

- **[michal.ai](https://michal.ai)**: portfolio, projects and writing. React Router 7 + Vite, every route prerendered, served by a
  Cloudflare Worker.
- **[halmic.com](https://halmic.com)**: streams, videos, tiny games and design. A zero-dependency static build plus one small Worker.

It is a working codebase, published so people can read how the sites are built. It is not a template or a library, and it is
not looking for feature contributions (see [Contributing](#contributing)).

## Contents

- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Commands](#commands)
- [Deploying](#deploying)
- [Identity separation](#identity-separation)
- [Adding a shared package](#adding-a-shared-package)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Getting started

You need **Node.js 22** (what CI uses) and npm.

```bash
git clone https://github.com/ItsMichal/space.git
cd space
npm ci
npm run dev:michal   # http://localhost:3100
npm run dev:halmic   # http://localhost:4310
```

Posts and media are edited in a separate private repository and pulled in at build time (`npm run content:pull`, see
[`apps/michal-ai/docs/content-repo.md`](apps/michal-ai/docs/content-repo.md)). Without access to it, the build uses the content
already in this repository, so a fresh clone runs as is.

Before opening a pull request, run everything CI runs:

```bash
npm run check
```

Working with an AI coding agent? Start from [`AGENTS.md`](AGENTS.md): rules, traps and the identity rule. App specifics are in
[`apps/halmic/AGENTS.md`](apps/halmic/AGENTS.md) and [`apps/michal-ai/AGENTS.md`](apps/michal-ai/AGENTS.md).

## Repository layout

npm workspaces, one lockfile at the root. No Turborepo: three apps and four small packages do not need a task graph, and
`npm run -w` is enough.

```
apps/
  michal-ai/   the portfolio, Worker `space`, https://michal.ai
  halmic/      halmic.com, Worker `halmic` (see apps/halmic/README.md)
  sports/      a private, passkey-gated host for a browser game build, Worker `halmic-sports` (see apps/sports/README.md)
packages/
  motion/      @space/motion       spring, stroke and petal-physics toolkit (TypeScript source)
  tokens/      @space/tokens       design-token structure and the tokens.json to CSS generator (each app keeps its own values)
  config/      @space/config       shared tsconfig, eslint and prettier bases
  crosslinks/  @space/crosslinks   the one sanctioned link between the sites: logo switcher marks and the paired-content map
scripts/       repo-level checks (identity, location, dashes, slugs, type) and the post-deploy smoke test
docs/          deploying, identity separation, and the history of how the repo was assembled (docs/monorepo, not current state)
```

Each app builds and deploys on its own. Nothing in `packages/` talks to the network or knows which app uses it.

Where things live:

- Portfolio code, content (`content/posts/*.md`), media, Worker (`worker/`) and `wrangler.jsonc`: `apps/michal-ai/`. The `@/`
  import alias is local to the app.
- Motion maths and hooks (`useSpring`, `useSpringSet`, `settle`, `handStroke`, `linearSpring`, `petalPhysics`...):
  `packages/motion/src`, imported as `@space/motion/<module>`.
- The sibling link between the two sites: `packages/crosslinks`.
- Token generator: `packages/tokens`. The portfolio's values stay in `apps/michal-ai/docs/design-system/tokens.json`;
  `npm run tokens -w @space/michal-ai` regenerates `app/styles/tokens.css`.

## Commands

Run at the repo root.

| Command | What it does |
| --- | --- |
| `npm ci` | install everything (use `npm install` after pulling a change that adds a workspace package, or it is not linked) |
| `npm run dev:michal` | portfolio dev server (builds image variants first) |
| `npm run dev:halmic` | build halmic and serve it at http://localhost:4310/ |
| `npm run build:michal` / `build:halmic` | production build of one app |
| `npm run typecheck` / `lint` / `test` | across all workspaces that define the script |
| `npm run check:identity` | content identity guard (see [Identity separation](#identity-separation)) |
| `npm run check:location` | no city-level home location anywhere in the repo |
| `npm run check:dashes` | no em or en dash in what the portfolio ships |
| `npm run check:slugs` | portfolio post slugs and redirects |
| `npm run check:type` | michal.ai font sizes stay on the four-step type scale |
| `npm run check` | all of the above: typecheck, lint, test and every guard |

Inside an app directory the usual scripts still work (`cd apps/michal-ai && npm test`). Build-time scripts under
`apps/michal-ai/scripts/` `chdir` to the app root themselves, so `node apps/michal-ai/scripts/build-images.mjs` works from
anywhere, and so do `npm run -w` invocations. Every `process.cwd()` in the app (content reader, media manifest, OG fonts,
redirects, editor) assumes the app root; Vite, vitest, wrangler and `npm -w` all start there.

## Deploying

Merging to `main` deploys. `.github/workflows/deploy.yml` checks, builds, deploys and smoke-tests each app whose files changed,
one deploy at a time; `ci.yml` verifies pull requests. Secrets live in GitHub Actions and are never committed.

Manual runs, rollbacks and the one-time Cloudflare and GitHub setup: [`docs/deploying.md`](docs/deploying.md).

## Identity separation

`halmic` is a handle, and halmic.com must not carry the owner's real name in anything it ships. `npm run check:identity` (run by
CI) enforces that, and allows exactly one door between the two sites: the logo switcher and one link per genuinely shared piece,
mapped in `packages/crosslinks`. The full rule: [`docs/identity.md`](docs/identity.md).

## Adding a shared package

1. `mkdir packages/<name>` with a `package.json` named `@space/<name>` (`"private": true`, `exports` pointing at source).
2. Add `"@space/<name>": "*"` to the consuming app's dependencies and run `npm install` at the root.
3. TypeScript source packages need no build step: the portfolio's Vite config bundles every `@space/*` package for SSR
   (`ssr.noExternal`).
4. Give it a `test` and `typecheck` script; the root scripts pick them up automatically.
5. Do not share runtime code that carries identity (copy, names, URLs, analytics ids) between the two sites.

Could be shared later, deliberately not extracted yet: `components/glass`, `components/shader-image`, `components/backdrop`,
`components/ui`, `lib/content` and `lib/og` from the portfolio. Extract one when halmic needs it, and only the parts that carry
no copy or branding.

## Contributing

This is a personal site, so most changes are the owner's. Bug reports are welcome as
[issues](https://github.com/ItsMichal/space/issues): a broken page, a layout that falls apart on some device, an accessibility
problem. For anything larger, open an issue before a pull request. Pull requests should pass `npm run check`.

## Security

Please do not report security problems in public issues. See [`SECURITY.md`](SECURITY.md).

## License

No license has been chosen for this repository yet, so the default applies: the code and content are copyright of the owner,
and you may view and fork them on GitHub but not reuse them elsewhere. The posts, photos, videos and brand marks are not for
reuse in any case.

Third-party pieces keep their own licenses, which sit next to them, for example
[`apps/michal-ai/components/stageshow/LICENSE`](apps/michal-ai/components/stageshow/LICENSE) (MIT),
[`apps/halmic/brand/icons/phosphor/LICENSE`](apps/halmic/brand/icons/phosphor/LICENSE) and
[`apps/michal-ai/lib/og-fonts/LICENSE-IBMPlexMono.txt`](apps/michal-ai/lib/og-fonts/LICENSE-IBMPlexMono.txt).
