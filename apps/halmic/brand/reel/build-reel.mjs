// Rebuilds the hero reel (public/hero/reel-1080.webm, reel-720.webm, reel-m.webm, reel-720.mp4, reel-m.mp4, reel-poster.jpg, reel-poster-m.jpg) from edl.json.
// usage: REEL_SRC=/path/to/dir-with-source-mp4s node brand/reel/build-reel.mjs   (needs ffmpeg with libvpx-vp9, libx264, minterpolate)
// Optional env: REEL_VARIANT=L|P (cut only that variant), REEL_JOBS (parallel cuts, default 3), REEL_NOLOOP=1 (stop after the segments), REEL_TMP (scratch dir), REEL_ONLY=3,5 (re-cut just these moment indices, reuse the rest from REEL_TMP), REEL_SKIP_ENC=1 (stop after the two loops),
// CRF1080 CRF720 CRFM CRFMP4 CRFMMP4, POSTER_Q. Source footage is never committed; see README.md.
import { spawn, spawnSync } from 'node:child_process';
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
const N = Math.round((srcSeconds / speed) * fps);          // frames per moment after slowing
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('exit', (c) => (c ? rej(new Error(`${cmd} failed: ${args.join(' ')}`)) : res())); });
const ff = (args) => run('ffmpeg', ['-v', 'error', '-y', ...args]);
const pool = async (jobs, n) => { const q = [...jobs]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await q.shift()(); })); };

const srcDims = (f) => { const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' }); const [w, h] = r.stdout.trim().split(',').map(Number); return { w, h }; };
// crops in edl.json are w:h:x:y in a 1280x720 reference frame; scale them to the real source size (even numbers)
const scaleCrop = (c, w) => { const k = w / 1280, ev = (v) => 2 * Math.round(v * k / 2); const [cw, ch, cx, cy] = c.split(':').map(Number); return `${ev(cw)}:${ev(ch)}:${ev(cx)}:${ev(cy)}`; };

// grade, applied after the exposure stretch: modest saturation (the shader reads the footage's chroma for its violet ink), a gentle S that lifts black to the ink colour,
// a light unsharp so edges survive the halftone, and a little denoise so the encode spends its bits on shapes instead of sensor noise. No blur.
const GRADE = "eq=saturation=0.9:contrast=1.06,curves=all='0/0.045 0.3/0.25 0.7/0.68 1/0.93',unsharp=5:5:0.7:3:3:0.0,hqdn3d=1.2:1.2:5:5";
// exposure: each moment's 10th and 90th luminance percentiles (ffmpeg signalstats) are stretched to black and white before the grade,
// so a dark arena and a bright game screen land at the same level (gain is limited so dark scenes do not blow up noise)
function levels(m, file, w) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(m.in), '-t', String(srcSeconds), '-i', file, '-an', '-vf', `crop=${scaleCrop(m.crop, w)},scale=320:-2,signalstats,metadata=mode=print:file=-`, '-f', 'null', '-'], { encoding: 'utf8' });
  const v = (k) => { const a = [...r.stdout.matchAll(new RegExp(`lavfi.signalstats.${k}=([0-9.]+)`, 'g'))].map((x) => +x[1]); return a.reduce((x, y) => x + y, 0) / a.length; };
  const lo = v('YLOW'), hi = Math.max(v('YHIGH'), lo + 70);
  return { lo: Math.round(lo), hi: Math.round(hi) };
}
const only = process.env.REEL_ONLY?.split(',').map(Number);
// Landscape: the crop, scaled to 1920x1080. Portrait: a WIDE crop (any aspect, usually 16:10) laid across the phone frame at width 540 with its centre at `pc` of the 960 px
// height (default .295: the open window above the wordmark on a phone, see WIN_UP in hero.js), feathered into a dark blurred copy of itself that fills the rest. The subject is
// seen whole instead of a tight 9:16 slice.
const PW = 540, PH = 960;
function chain(m, k, lv, w) {
  const exposure = `lutyuv=y='clip((val-${lv.lo})*219/(${lv.hi}-${lv.lo})+16,16,235)'`;
  const slow = `setpts=PTS/${speed},minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,${GRADE},format=yuv420p`;
  if (k === 'L') return ['-vf', `crop=${scaleCrop(m.crop, w)},scale=1920:1080:flags=lanczos,${exposure},${slow}`];
  const [cw, ch] = m.pcrop.split(':').map(Number);
  const fgh = 2 * Math.round(PW * ch / cw / 2), pc = m.pc ?? 0.295;
  const y = Math.max(0, Math.min(PH - fgh, Math.round(PH * pc - fgh / 2)));
  return ['-filter_complex', `[0:v]crop=${scaleCrop(m.pcrop, w)},${exposure},split=2[a][b];` +
    `[a]scale=${PW}:${PH}:force_original_aspect_ratio=increase:flags=bilinear,crop=${PW}:${PH},boxblur=22:3,eq=brightness=-0.32:saturation=0.8[bg];` +
    `[b]scale=${PW}:${fgh}:flags=lanczos,format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*min(1,min(Y,H-1-Y)/44)'[fg];` +
    `[bg][fg]overlay=0:${y}:format=auto,${slow}[o]`, '-map', '[o]'];
}
const VARIANTS = [{ k: 'L' }, { k: 'P' }].filter((v) => !process.env.REEL_VARIANT || process.env.REEL_VARIANT === v.k);
const jobs = [];
edl.moments.forEach((m, i) => {
  if (only && !only.includes(i)) return;
  const file = path.join(src, `${m.src}.mp4`), { w } = srcDims(file);
  const lv = levels(m, file, w); console.log(`moment ${i}: levels ${lv.lo}..${lv.hi}`);
  for (const v of VARIANTS) {
    jobs.push(() => ff(['-ss', String(m.in), '-t', String(srcSeconds + 0.2), '-i', file, '-an', ...chain(m, v.k, lv, w),
      '-frames:v', String(N), '-c:v', 'libx264', '-preset', 'fast', '-crf', '6', path.join(tmp, `seg${v.k}${i}.mp4`)]));
  }
});
await pool(jobs, +(process.env.REEL_JOBS ?? 3));
if (process.env.REEL_NOLOOP) process.exit(0);   // segments only

// chain the crossfades with the first moment repeated at the end, then cut one full cycle out of the middle so the last frame leads into the first
const n = edl.moments.length, ins = [...Array(n).keys(), 0], cycle = (N - X) * n;
async function loopOf(k) {
  let g = '', prev = '[0:v]';
  for (let j = 1; j < ins.length; j++) { g += `${prev}[${j}:v]xfade=transition=fade:duration=${X / fps}:offset=${((N - X) * j) / fps}[x${j}];`; prev = `[x${j}]`; }
  g += `${prev}trim=start_frame=${X}:end_frame=${X + cycle},setpts=PTS-STARTPTS,fps=${fps}[loop]`;
  const f = path.join(tmp, `loop${k}.mkv`);
  await ff([...ins.flatMap((i) => ['-i', path.join(tmp, `seg${k}${i}.mp4`)]), '-filter_complex', g, '-map', '[loop]', '-an', '-c:v', 'ffv1', f]);
  return f;
}
const [loopL, loopP] = await Promise.all([loopOf('L'), loopOf('P')]);
console.log(`loop: ${(cycle / fps).toFixed(2)} s, ${cycle} frames`);
if (process.env.REEL_SKIP_ENC) process.exit(0);

// encodes (no audio track anywhere)
fs.mkdirSync(out, { recursive: true });
// a strong spatio-temporal denoise just before encoding: the footage is graded dark and the shader re-screens it, so noise is wasted bytes
const DN = 'hqdn3d=3:3:9:9';
const vp9 = (loop, file, w, crf, extra = []) => ff(['-i', loop, '-an', '-vf', `${DN},scale=${w}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', '-tile-columns', '1', '-deadline', 'good', '-cpu-used', '1', '-lag-in-frames', '25', '-auto-alt-ref', '1', '-g', '96', '-pix_fmt', 'yuv420p', ...extra, path.join(out, file)]);
const h264 = (loop, file, w, crf) => ff(['-i', loop, '-an', '-vf', `${DN},scale=${w}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', String(crf), '-g', '96', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', path.join(out, file)]);
await Promise.all([
  vp9(loopL, 'reel-1080.webm', 1920, +(process.env.CRF1080 ?? 54)),
  vp9(loopL, 'reel-720.webm', 1280, +(process.env.CRF720 ?? 54)),
  vp9(loopP, 'reel-m.webm', 540, +(process.env.CRFM ?? 52)),
  h264(loopL, 'reel-720.mp4', 1280, +(process.env.CRFMP4 ?? 35)),
  h264(loopP, 'reel-m.mp4', 540, +(process.env.CRFMMP4 ?? 36)),
]);
// posters: one recognisable frame (edl.poster = [moment index, frames into it]), same grade as the video
const pf = (N - X) * edl.poster[0] - X + edl.poster[1];
const still = (loop, file, w) => ff(['-i', loop, '-vf', `select=eq(n\\,${pf}),scale=${w}:-2:flags=lanczos,format=yuvj420p`, '-frames:v', '1', '-q:v', String(process.env.POSTER_Q ?? 4), path.join(out, file)]);
await Promise.all([still(loopL, 'reel-poster.jpg', 1280), still(loopP, 'reel-poster-m.jpg', 540)]);
for (const f of fs.readdirSync(out).filter((x) => x.startsWith('reel-'))) console.log(f, fs.statSync(path.join(out, f)).size);
