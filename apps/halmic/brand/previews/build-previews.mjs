// Rebuilds public/previews/<id>.webm|.mp4 (hover previews) from edl.json. Sources are never committed; see README.md.
// usage: PREVIEW_SRC=/dir/with/downloaded/sources node brand/previews/build-previews.mjs [id ...]   (needs ffmpeg with libvpx-vp9 and libx264)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'public', 'previews');
const src = process.env.PREVIEW_SRC;
if (!src) { console.error('set PREVIEW_SRC to the directory holding the downloaded sources (yt-<id>.mp4, clip-<slug>.mp4)'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const edl = JSON.parse(fs.readFileSync(path.join(here, 'edl.json'), 'utf8'));
const only = process.argv.slice(2);
const ff = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status) throw new Error(`ffmpeg failed: ${args.join(' ')}`); };
const encode = (name, parts, w, h, crf, crfMp4) => {
  // hard-cut the segments together; each segment is cropped (optional), scaled to cover w x h, 24 fps, no audio
  const n = parts.length;
  const chains = parts.map((p, i) => `[${i}:v]${p.crop ? `crop=${p.crop},` : ''}scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},fps=${edl.fps},setsar=1[v${i}]`);
  const fc = `${chains.join(';')};${parts.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0,format=yuv420p[o]`;
  const inputs = parts.flatMap((p) => ['-ss', String(p.start), '-t', String(p.len), '-i', p.file]);
  const base = [...inputs, '-filter_complex', fc, '-map', '[o]', '-an'];
  ff([...base, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', '-g', '48', path.join(out, `${name}.webm`)]);
  ff([...base, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', String(crfMp4), '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
  console.log(name, ['webm', 'mp4'].map((e) => `${e} ${(fs.statSync(path.join(out, `${name}.${e}`)).size / 1024).toFixed(0)} KB`).join(', '));
};
for (const v of edl.videos) {
  if (only.length && !only.includes(v.id)) continue;
  const file = path.join(src, `yt-${v.id}.mp4`);
  const parts = v.ranges.map((start) => ({ file, start, len: edl.momentSeconds, crop: v.crop }));
  const [w, h] = v.big ? [640, 360] : [480, 270];
  encode(v.id, parts, w, h, +(process.env.CRF ?? v.crf ?? 40), +(process.env.CRFMP4 ?? (v.big ? 32 : 33)));
}
for (const c of edl.clips) {
  if (only.length && !only.includes(c.id)) continue;
  encode(`clip-${c.id}`, [{ file: path.join(src, c.src), start: c.start, len: edl.clipSeconds, crop: c.crop }], 480, 270, +(process.env.CRF ?? 40), +(process.env.CRFMP4 ?? 33));
}
// the client reads this list (build.mjs writes previews/index.json from the directory listing)
