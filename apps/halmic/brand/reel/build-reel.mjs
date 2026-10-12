// Rebuilds the hero reel (public/hero/reel-720.webm, reel-720.mp4, reel-540.webm, reel-poster.jpg) from edl.json.
// usage: REEL_SRC=/path/to/dir-with-source-mp4s node brand/reel/build-reel.mjs   (needs ffmpeg with libvpx-vp9 and libx264)
// REEL_TMP overrides the scratch directory. Source footage is never committed; see README.md.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'public', 'hero');
const src = process.env.REEL_SRC;
if (!src) { console.error('set REEL_SRC to the directory holding the downloaded sources (<name>.mp4 as listed in edl.json)'); process.exit(1); }
const tmp = process.env.REEL_TMP ?? fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
fs.mkdirSync(tmp, { recursive: true });
const edl = JSON.parse(fs.readFileSync(path.join(here, 'edl.json'), 'utf8'));
const { fps, speed, srcSeconds, crossfadeFrames: X } = edl;
const N = Math.round((srcSeconds / speed) * fps);          // frames per moment after slowing (80)
const ff = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status) throw new Error(`ffmpeg failed: ${args.join(' ')}`); };

// 1. each moment: crop, scale to 720p, slow to `speed` with motion interpolation, grade flat toward the ink colour, soften
const GRADE = "eq=saturation=0.25,curves=all='0/0.055 0.3/0.2 0.6/0.42 1/0.64',colorchannelmixer=rr=0.92:gg=0.95:bb=1.08,gblur=sigma=2.2";
edl.moments.forEach((m, i) => {
  ff(['-ss', String(m.in), '-t', String(srcSeconds + 0.2), '-i', path.join(src, `${m.src}.mp4`), '-an',
    '-vf', `crop=${m.crop},scale=1280:720:flags=lanczos,setpts=PTS/${speed},minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,${GRADE},format=yuv444p`,
    '-frames:v', String(N), '-c:v', 'ffv1', path.join(tmp, `seg${i}.mkv`)]);
});

// 2. chain the crossfades with the first moment repeated at the end, then cut one full cycle out of the middle so the last frame leads into the first
const n = edl.moments.length, ins = [...Array(n).keys(), 0];
let g = '', prev = '[0:v]';
for (let k = 1; k < ins.length; k++) { const o = `${(N - X) * k}`; g += `${prev}[${k}:v]xfade=transition=fade:duration=${X / fps}:offset=${Number(o) / fps}[x${k}];`; prev = `[x${k}]`; }
const cycle = (N - X) * n;
g += `${prev}trim=start_frame=${X}:end_frame=${X + cycle},setpts=PTS-STARTPTS,fps=${fps}[loop]`;
const loop = path.join(tmp, 'loop.mkv');
ff([...ins.flatMap((i) => ['-i', path.join(tmp, `seg${i}.mkv`)]), '-filter_complex', g, '-map', '[loop]', '-an', '-c:v', 'ffv1', loop]);
console.log(`loop: ${(cycle / fps).toFixed(2)} s, ${cycle} frames`);

// 3. encodes (no audio track anywhere)
fs.mkdirSync(out, { recursive: true });
const vp9 = (file, w, crf) => ff(['-i', loop, '-an', '-vf', `scale=${w}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', '-g', '120', '-pix_fmt', 'yuv420p', path.join(out, file)]);
vp9('reel-720.webm', 1280, +(process.env.CRF720 ?? 40));
vp9('reel-540.webm', 960, +(process.env.CRF540 ?? 44));
ff(['-i', loop, '-an', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', String(process.env.CRFMP4 ?? 30), '-movflags', '+faststart', '-pix_fmt', 'yuv420p', path.join(out, 'reel-720.mp4')]);
// poster: a calm frame (the racing stretch), same grade as the video
ff(['-i', loop, '-vf', `select=eq(n\\,${process.env.POSTER_FRAME ?? 110}),format=yuvj420p`, '-frames:v', '1', '-q:v', String(process.env.POSTER_Q ?? 6), path.join(out, 'reel-poster.jpg')]);
for (const f of fs.readdirSync(out).filter((x) => x.startsWith('reel-'))) console.log(f, fs.statSync(path.join(out, f)).size);
