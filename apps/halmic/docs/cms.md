# halmic CMS

The halmic content that changes often is edited in the same write editor as the other site, behind the same Cloudflare Access login, with a
site switch. The editor lives in the private content repo (`editor/`); this repo holds the rules and the build.

## What is editable, and where it lives

| Content repo (`halmic/`) | Lands in this app (`npm run content:pull`) | Rules |
| --- | --- | --- |
| `layout.json` | `content/layout.json` (default `{ "version": 1 }` when absent) | `layout.mjs` |
| `curation.json` | `content/curation.json` | `checkCuration` |
| `posts.json`, `posts/<image>` | `content/posts.json`, `public/posts/` | `checkPosts` |
| `mountaintop/index.json`, `mountaintop/*.md`, `mountaintop/images/<image>` | `content/mountaintop/`, `public/work/mountaintop/` | `checkMountaintop` |

Not editable: `videos.json` and its exclude, held and manual lists (the YouTube sync), `games.json` (itch.io), `phoenix-rising.json` (verified facts only),
the denylists. The rules read those from this repo so an edit can only point at videos and games that exist.

## The layout file

```json
{
  "version": 1,
  "sections": [{ "id": "games", "title": "Play" }, { "id": "work", "clusters": ["edits", "phoenix"] }],
  "clusters": {
    "tiny": { "order": ["games:engines"], "sizes": { "game:soupman": "w2" }, "hidden": ["itch"] },
    "dental": { "hide": true }
  }
}
```

- `sections` pins sections to the top in that order (the rest follow in the default order), renames them, hides them, or moves clusters into them.
- `clusters.<id>` pins tiles first (`order`), resizes them (`sizes`: `one`, `w2`, `x4`, `lead`), hides tiles (`hidden`; the flex tile's id hides the
  flex tile) or hides the whole cluster (`hide`; `/games/` and `/videos/` still show it).
- Ids are in `bentos.mjs`. Sections: `stream`, `games`, `work`, `posts`, `elsewhere`. Clusters: `films`, `fifa`, `edits`, `clips`, `mountaintop`, `tiny`,
  `phoenix`, `dental`, `posts`, `elsewhere`. Tiles: `film:<video id>`, `ep:<video id>`, `video:<video id>`, `game:<slug>`, `post:<id>`, and the named
  ones (`fifa:year`, `fifa:minutes`, `mt:lead`, `mt:year`, `games:engines`, `pr:lead`, `pr:channel`, `sedd`, `hi`).
- Refused (by the build, `npm run content:check` and the editor): unknown ids, hiding `stream`, `games` or `work` (other pages link to them), hiding the
  Twitch or hi tiles or anything holding them, arranging the clip placeholders one by one, sizing a flex tile, and a cluster without a flex tile that
  leaves a gap in its last row at 4, 3 or 2 columns.

## Flow

1. The owner edits in the write editor and saves. The editor's Worker commits to a `write/halmic-*` branch of the content repo and opens a pull
   request; the content repo's CI checks out this repo and runs `node apps/halmic/scripts/content/validate.mjs --from <absolute path to its halmic/>`
   (the same rules, the same denylist).
2. Merging that pull request dispatches this repo's Deploy workflow with `app=halmic` (like a manual run, it ignores the `DEPLOY_HALMIC` gate).
3. Deploy checks out the content repo (`./.github/actions/content` with `app: halmic`), runs `npm run content:pull` (validate, then copy), builds,
   runs the identity check on the output and deploys.

## Local

```bash
git clone <content repo> /some/where/content        # outside apps/halmic: the identity check scans everything under it
npm run content:pull -w @space/halmic -- --from /some/where/content
npm run build:halmic && npm test -w @space/halmic
```

The copies in this repo are a fallback (fork pull requests, no credentials). After pulling, commit the changed `content/` and `public/` files only
if you mean to update that fallback.
