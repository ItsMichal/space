#!/usr/bin/env node
// What the CMS-edited content must agree with, read from this repo: the channel's videos and exclude list (YouTube sync), games.json (itch.io),
// phoenix-rising.json, and which videos have a poster in public/videos. validate.mjs passes these to checkFolder; the editor bundles them
// (node scripts/content/facts.mjs > <file>) so its checks and previews match the build's.
import fs from 'node:fs';
import path from 'node:path';

export function repoFacts(app = path.resolve(import.meta.dirname, '..', '..')) {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(app, 'content', p), 'utf8'));
  return {
    videos: read('videos.json'), exclude: read('videos.exclude.json'), games: read('games.json'), phoenix: read('phoenix-rising.json'),
    thumbs: fs.readdirSync(path.join(app, 'public/videos')).filter((f) => /^[\w-]{11}\.jpg$/.test(f)).map((f) => f.slice(0, -4)).sort(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) process.stdout.write(`${JSON.stringify(repoFacts())}\n`);
