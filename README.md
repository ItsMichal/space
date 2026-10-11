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
| `npm run deploy:michal` / `deploy:halmic` | build and deploy one Worker (needs `wrangler login`) |

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

Deploys are manual (`npm run deploy:michal`) or through Cloudflare Workers Builds. CI in this repo only verifies.

To use Workers Builds (owner action in the Cloudflare dashboard, once per Worker):

- Worker `space` (portfolio): Root directory `apps/michal-ai`; build command `(cd ../.. && npm ci) && npx opennextjs-cloudflare build` (workspaces install from the repo root);
  deploy command `npx opennextjs-cloudflare deploy`. Watch paths: `apps/michal-ai/**`, `packages/**`.
- Worker `halmic`: Root directory `apps/halmic`; build and deploy commands as defined in that app's README.
  Watch paths: `apps/halmic/**`, `packages/**`.

Keep the two Workers on separate Cloudflare projects/routes so a build of one never touches the other.

## Identity separation

`halmic` is a handle; its site must not carry the owner's real name in anything it ships. `scripts/check-identity.mjs`
(run by CI and `npm run check`) fails when `apps/halmic` source, content, public files or build output matches a pattern in
`scripts/identity-denylist.txt` (docs and READMEs excluded). It also prints a soft warning when the portfolio's shipped copy
mentions the handle outside `scripts/identity-allowlist.txt`. The link between the two at the repository level is accepted.

## Could be shared later (deliberately not extracted yet)

`components/glass` (Liquid Glass; geometry already uses `@space/motion`), `components/shader-image`, `components/backdrop`,
`components/ui` (micro-UI kit), `lib/content` (markdown pipeline), `lib/og`. Extract when halmic actually needs one of them,
and only the parts that carry no copy or branding.
