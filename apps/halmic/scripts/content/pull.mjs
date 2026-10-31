#!/usr/bin/env node
// npm run content:pull: bring the halmic content the CMS edits in from the private content repo (its halmic/ folder) and lay it out
// where build.mjs reads it. The build keeps reading the same places; once the content repo is the source of truth this script is the
// only way they change (docs/cms.md).
//
//   halmic/layout.json                 -> content/layout.json (the default arrangement when absent)
//   halmic/curation.json, posts.json   -> content/
//   halmic/posts/<image>               -> public/posts/ (the folder becomes exactly these)
//   halmic/mountaintop/index.json, *.md -> content/mountaintop/ (the .md files become exactly these)
//   halmic/mountaintop/images/<image>  -> public/work/mountaintop/ (the folder becomes exactly these)
//
// Source: --from <checkout> or CONTENT_DIR=<checkout>, a checkout of the content repo made elsewhere (CI checks it out with read-only
// credentials and passes its path; docs/cms.md has the local steps). It is never cloned under apps/halmic: the identity check scans
// everything there, and the content repo also holds the other site's posts.
// The folder is validated first (scripts/content/validate.mjs --from); nothing is copied unless it passes.
// A checkout without a halmic/ folder changes nothing: the build uses the content in this repo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..', '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

const from = arg('--from') ?? process.env.CONTENT_DIR;
if (!from || !fs.existsSync(from)) { console.error(`content: pass --from <checkout> or CONTENT_DIR=<checkout> (a checkout of the content repo; see docs/cms.md)${from ? `; ${from} does not exist` : ''}`); process.exit(1); }
const repo = path.resolve(from);
const src = path.join(repo, 'halmic');
if (!fs.existsSync(src)) { console.log(`content: ${repo} has no halmic/ folder yet; building with the halmic content in this repo`); process.exit(0); }

run(process.execPath, [path.join(app, 'scripts', 'content', 'validate.mjs'), '--from', src], { cwd: app });

// validate.mjs refused symlinks and unexpected files; copy only regular files, by name
const IMG = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(webp|jpg|png)$/;
const mirror = (from, to, keep) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(to)) if (keep.test(f)) fs.rmSync(path.join(to, f));
  let n = 0;
  if (fs.existsSync(from)) for (const e of fs.readdirSync(from, { withFileTypes: true })) if (e.isFile() && keep.test(e.name)) { fs.copyFileSync(path.join(from, e.name), path.join(to, e.name)); n++; }
  return n;
};
for (const f of ['curation.json', 'posts.json']) fs.copyFileSync(path.join(src, f), path.join(app, 'content', f));
const layout = path.join(src, 'layout.json');
if (fs.existsSync(layout)) fs.copyFileSync(layout, path.join(app, 'content/layout.json'));
else fs.writeFileSync(path.join(app, 'content/layout.json'), '{ "version": 1 }\n');
const media = mirror(path.join(src, 'posts'), path.join(app, 'public/posts'), IMG);
const logs = mirror(path.join(src, 'mountaintop'), path.join(app, 'content/mountaintop'), /^(index\.json|[a-z0-9-]+\.md)$/);
const images = mirror(path.join(src, 'mountaintop', 'images'), path.join(app, 'public/work/mountaintop'), IMG);

const sha = (() => { try { return execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unknown'; } })();
console.log(`content: halmic ${logs} Mountaintop files, ${media + images} images and ${fs.existsSync(layout) ? 'the layout file' : 'the default layout'} from space-content ${sha}`);
