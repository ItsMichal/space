#!/usr/bin/env node
// npm run content:check: validate the halmic content the CMS edits (checkFolder in content-rules.mjs, with the identity denylist).
//
//   node scripts/content/validate.mjs                 the content in this repo (content/, public/posts, public/work/mountaintop)
//   node scripts/content/validate.mjs --from <dir>    a content repo halmic/ folder, before content:pull copies it:
//                                                      layout.json, curation.json, posts.json, posts/<image>, mountaintop/{index.json,*.md,images/<image>}
// What the edits must agree with (videos.json, games.json, phoenix-rising.json, the video posters) is always read from this repo (facts.mjs).
// Exits 1 with every problem listed. Files are read only if they are regular files (a symlink could point anywhere on the machine).
import fs from 'node:fs';
import path from 'node:path';
import { checkFolder } from '../../content-rules.mjs';
import { repoFacts } from './facts.mjs';
import { scanContent } from '../../../../scripts/identity-lib.mjs';

const app = path.resolve(import.meta.dirname, '..', '..');
const root = path.resolve(app, '..', '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const from = arg('--from') ? path.resolve(arg('--from')) : null;
if (from && !fs.existsSync(from)) { console.error(`content: ${from} does not exist`); process.exit(1); }

const problems = [];
const files = {};
const TEXT = /\.(json|md)$/;
const add = (rel, abs) => {
  const s = fs.lstatSync(abs, { throwIfNoEntry: false });
  if (!s) return;
  if (!s.isFile()) return problems.push(`${rel} is not a regular file`);
  files[rel] = { size: s.size, ...(TEXT.test(rel) ? { text: fs.readFileSync(abs, 'utf8') } : {}) };
};
// every file under dir (dotfiles skipped), as folder paths under prefix
const walk = (dir, prefix, keep = () => true) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = `${prefix}${e.name}`, abs = path.join(dir, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) walk(abs, `${rel}/`, keep);
    else if (keep(e.name)) add(rel, abs);
  }
};
if (from) walk(from, '');
else {
  for (const f of ['layout.json', 'curation.json', 'posts.json']) add(f, path.join(app, 'content', f));
  const img = (n) => /\.(webp|jpg|png)$/.test(n);
  walk(path.join(app, 'public/posts'), 'posts/', img);
  walk(path.join(app, 'public/work/mountaintop'), 'mountaintop/images/', img);
  for (const n of fs.readdirSync(path.join(app, 'content/mountaintop'))) if (/^(index\.json|[a-z0-9-]+\.md)$/.test(n)) add(`mountaintop/${n}`, path.join(app, 'content/mountaintop', n));
}

// identity: the same denylist and rule as the build output check (scripts/check-identity.mjs)
const deny = fs.readFileSync(path.join(root, 'scripts/identity-denylist.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((p) => new RegExp(p, 'i'));
problems.push(...checkFolder(files, { ...repoFacts(app), identity: (t) => scanContent(t, deny) }));

if (problems.length) { console.error(`halmic content: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n  ${problems.join('\n  ')}`); process.exit(1); }
const n = (re) => Object.keys(files).filter((p) => re.test(p)).length;
console.log(`halmic content ok: ${JSON.parse(files['posts.json'].text).posts.length} posts, ${n(/^mountaintop\/(?!project\.md)[^/]+\.md$/)} dev logs, ${n(/\.(webp|jpg|png)$/)} images${from ? ` (from ${from})` : ''}`);
