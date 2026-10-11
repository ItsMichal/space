// halmic logotype generator.
// Every letter is built from the mark's own geometry (measured from mark.svg):
//   bar thickness T = 53.0  (cap radius R = T/2 = 26.5, fully round)
//   lean            = 13 deg (skewX; tan 13 = 0.2309; measured from the mark's bar edges)
//   dot             = circle of diameter T, sheared the same way
//   long bar        = 235.02 (ascender / full height)   short bar = 148.21 (x-height)
//   "!" bar         = 140.54, gap 41.5, dot 53  (the i is the "!" turned over)
// Letters are drawn upright, then every point is sheared by the lean. Output is plain
// path data (cubic curves); strokes are separate overlapping shapes, exactly like the mark.
// Usage: node build-logotype.mjs   (writes ./svg/*.svg and ./geometry.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
import { T, R, B, XH, XT, BANG, LEAN, SK, f, arc, pol, capsule, ring, dot, stem, sh, dOf, bbox } from './lib.mjs';
import { flatten, parsePath, profile, solve, meanGap, minGap } from './spacing.mjs';
// ---------- letters ----------
// Each letter: (opts) -> { shapes, adv, ink:[left,right] } in upright space starting at x=0 (stem centre at R)
// shared bits
const bowlC = (cx) => [cx, B - XH / 2];
const RC = XH / 2 - R;                                   // centreline radius of a round bowl

function makeLetters(v) {
  const L = {};
  const archTop = XT + R;                                // centreline y of an arch top
  // arch shoulder from stem x0 to stem x1; style decides shape
  function shoulder(x0, x1, kind = v.arch) {
    const w = x1 - x0;
    if (kind === 'round') {                            // semicircle
      return [ring((x0 + x1) / 2, archTop + w / 2, w / 2, Math.PI, 2 * Math.PI)];
    }
    if (kind === 'stadium') {                          // flat-topped, corner radius rc
      const rc = v.rc;
      return [ring(x0 + rc, archTop + rc, rc, Math.PI, 1.5 * Math.PI), capsule([x0 + rc, archTop], [x1 - rc, archTop]),
              ring(x1 - rc, archTop + rc, rc, 1.5 * Math.PI, 2 * Math.PI)];
    }
    // slash: one diagonal from the stem's x-height down to the right stem (the mark's M diagonal, same direction)
    return [capsule([x0, archTop], [x1, archTop + v.drop])];
  }
  const archDrop = v.arch === 'round' ? (x0, x1) => archTop + (x1 - x0) / 2 : v.arch === 'stadium' ? () => archTop + v.rc : () => archTop + v.drop;
  L.h = () => {
    const hk = v.hArch ?? v.arch, x0 = R, x1 = R + v.pitch, yj = hk === 'round' ? archTop + (x1 - x0) / 2 : archDrop(x0, x1);
    return { shapes: [stem(x0, 0, B), ...shoulder(x0, x1, hk), stem(x1, yj - R, B)], adv: v.pitch + T };
  };
  L.m = () => {
    const x0 = R, x1 = R + v.pitchM, x2 = R + 2 * v.pitchM, yj = archDrop(x0, x1);
    if (v.mEcho) {   // the monogram's M, small: stem, V of diagonals, stem
      const mid = (x0 + x2) / 2, vy = B - R - (v.mVDepth ?? 0);
      return { shapes: [stem(x0, XT, B), capsule([x0, XT + R], [mid, vy]), capsule([mid, vy], [x2, XT + R]), stem(x2, XT, B)], adv: 2 * v.pitchM + T };
    }
    return { shapes: [stem(x0, XT, B), ...shoulder(x0, x1), stem(x1, yj - R, B), ...shoulder(x1, x2), stem(x2, yj - R, B)], adv: 2 * v.pitchM + T };
  };
  L.l = () => ({ shapes: [stem(R, 0, B)], adv: T });
  L.i = () => ({ shapes: [stem(R, B - BANG, B), dot(R, R)], adv: T });
  L.a = () => {
    const cx = XH / 2, [, cy] = bowlC(cx), x = cx + RC;
    return { shapes: [ring(cx, cy, RC, 0, 2 * Math.PI), stem(x, XT, B)], adv: XH, bowl: true };
  };
  L.c = () => {
    const cx = XH / 2, [, cy] = bowlC(cx), ap = v.cAperture * Math.PI / 180;
    return { shapes: [ring(cx, cy, RC, ap, 2 * Math.PI - ap)], adv: XH * v.cWidth, bowl: true, open: true };
  };
  return L;
}

const DIRECTIONS = {
  a: { name: 'Bar', note: 'geometric-strict: semicircle arches, ring bowls, the mark\'s own proportions', arch: 'round', pitch: 96, pitchM: 92, cAperture: 42, cWidth: 1, gap: 30 },
  b: { name: 'Round', note: 'softer: flat-topped stadium shoulders, wider letters, looser tracking, small c aperture', arch: 'stadium', rc: 44, pitch: 118, pitchM: 108, cAperture: 44, cWidth: 1, gap: 40 },
  c: { name: 'Slash', note: 'tighter and diagonal: a single M-diagonal shoulder and a monogram-echo m (stem, V, stem), tight tracking', arch: 'slash', hArch: 'round', drop: 74, pitch: 92, pitchM: 90, mEcho: true, mVDepth: 20, cAperture: 48, cWidth: 1, gap: 20 },
};

// ---------- spacing ----------
// mode 'fixed': the first-round layout (constant gap plus three hand adjustments), kept for the before/after proof.
// mode 'optical': each pair is placed so the mean white per scanline across the x-height band equals a target,
// scaled by what the facing sides are (straight stem 1.0, round 0.88 against a stem, 0.8 round to round).
const CAP = 70, FLOOR = 12;
const SIDE = { h: 'SS', a: 'RS', l: 'SS', m: 'SS', i: 'SS', c: 'RR' };
const pairFactor = (l, r) => { const a = SIDE[l][1], b2 = SIDE[r][0]; return a === 'R' && b2 === 'R' ? 0.8 : a === 'R' || b2 === 'R' ? 0.88 : 1; };
function layout(v, text = 'halmic', mode = 'optical') {
  const L = makeLetters(v);
  let x = 0; const parts = []; let prev = null;
  for (const ch of text) {
    const g = L[ch]();
    const polys = g.shapes.flatMap((s) => flatten(s));
    g.band = profile(polys, XT, B); g.full = profile(polys, 0, B); g.ch = ch;
    let pair = null;
    if (prev) {
      if (mode === 'fixed') {
        let kern = v.gap;
        if (prev.bowl && !prev.open && !g.bowl) kern -= 6;
        if (g.bowl && !prev.bowl) kern -= 4;
        x += prev.adv + kern;
      } else {
        const d = solve(prev.band, g.band, v.gap * pairFactor(prev.ch, ch), CAP, FLOOR, prev.full, g.full);
        x += d;
      }
      pair = { from: prev.ch, to: ch, d: x - prev.x };
    }
    g.x = x; parts.push({ ch, shapes: g.shapes, dx: x, g, pair }); prev = g;
  }
  parts.forEach((p, i) => { if (i) { const q = parts[i - 1]; p.pair.mean = meanGap(q.g.band, p.g.band, p.pair.d, CAP); p.pair.min = minGap(q.g.full, p.g.full, p.pair.d); p.pair.meanUncapped = meanGap(q.g.band, p.g.band, p.pair.d, 1e9); } });
  return parts;
}

function wordmark(dir, o = {}) {
  const v = DIRECTIONS[dir], parts = layout(v, 'halmic', o.mode), all = [];
  const shift = [];
  for (const p of parts) for (const s of p.shapes) { all.push(s); shift.push(p.dx); }
  let x0 = 1e9, x1 = -1e9;
  all.forEach((s, i) => { const b = bbox([s], shift[i]); x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); });
  const ds = all.map((s, i) => dOf(s, shift[i] - x0));
  let k = 0;
  const groups = parts.map((p) => ({ ch: p.ch, ds: p.shapes.map(() => ds[k++]) }));
  return { w: x1 - x0, h: B, ds, groups, letters: parts.map((p) => p.ch), parts, x0 };
}

// ---------- mark (reused verbatim) ----------
const markSrc = fs.readFileSync(path.join(here, 'mark.svg'), 'utf8');
const markPaths = [...markSrc.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);
const MARK = { w: 349.92, h: 235.02 };

// ---------- svg assembly ----------
const COLORS = {
  ink: { fg: '#0f0e13', bg: '#f1ece1' },
  paper: { fg: '#f1ece1', bg: '#0f0e13' },
  accent: { fg: '#3d7bff', bg: '#0f0e13' },
};
const pathTag = (d, fill) => `<path d="${d}"${fill ? ` fill="${fill}"` : ''}/>`;
const wm = (dir, fill, tx = 0, ty = 0) => {
  const w = wordmark(dir);
  return { w: w.w, h: w.h, body: `<g fill="${fill}" transform="translate(${f(tx)} ${f(ty)})">${w.ds.map((d) => pathTag(d)).join('')}</g>` };
};
const mk = (fill, tx = 0, ty = 0, s = 1) => `<g fill="${fill}" transform="translate(${f(tx)} ${f(ty)})${s !== 1 ? ` scale(${s})` : ''}">${markPaths.map((d) => pathTag(d)).join('')}</g>`;
const doc = (w, h, body, bg, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" role="img" aria-label="${title}"><title>${title}</title>${bg ? `<rect width="${f(w)}" height="${f(h)}" fill="${bg}"/>` : ''}${body}</svg>\n`;

// mark-to-word distance: the same optical measure, with a larger target (the mark is a separate object, the gap reads as a word space)
const markProf = profile(markPaths.flatMap((d) => parsePath(d)), 0, B);
const LOCK_TARGET = 2.4 * T;
const lockGap = {};
for (const dir of Object.keys(DIRECTIONS)) {
  const w = wordmark(dir), h = w.parts[0].g;
  const shifted = (p) => ({ ...p, min: p.min.map((v) => v - w.x0), max: p.max.map((v) => v - w.x0) });
  lockGap[dir] = solve(markProf, shifted(h.full), LOCK_TARGET, 260, 40);
}
const out = path.join(here, 'svg');
fs.mkdirSync(out, { recursive: true });
const manifest = {};
function write(name, svg) { fs.writeFileSync(path.join(out, name), svg); manifest[name] = true; }

for (const dir of Object.keys(DIRECTIONS)) {
  for (const [cn, c] of Object.entries(COLORS)) {
    const w = wm(dir, c.fg);
    write(`wordmark-${dir}-${cn}.svg`, doc(w.w, w.h, w.body, null, 'halmic'));
    // horizontal lockup, mark at 1:1 beside wordmark at 1:1 (same bar thickness)
    const wl = wm(dir, c.fg, lockGap[dir], 0);
    write(`lockup-h-${dir}-${cn}.svg`, doc(lockGap[dir] + wl.w, B, mk(c.fg) + wl.body, null, 'halmic'));
    // stacked: mark above, wordmark centred below at 1:1, gap = 1 bar
    const wide = Math.max(MARK.w, wl.w), gy = MARK.h + T * 1.5;
    const ws = wm(dir, c.fg, (wide - w.w) / 2, gy);
    write(`lockup-stacked-${dir}-${cn}.svg`, doc(wide, gy + B, mk(c.fg, (wide - MARK.w) / 2, 0) + ws.body, null, 'halmic'));
  }
}
// mark-only tiles (the existing mark, untouched, centred in a rounded square) for avatars / favicons
for (const [cn, c] of Object.entries(COLORS)) {
  const S = 512, s = (S * 0.58) / MARK.w, mw = MARK.w * s, mh = MARK.h * s;
  write(`mark-tile-${cn}.svg`, doc(S, S, `<rect width="${S}" height="${S}" rx="${S * 0.225}" fill="${c.bg}"/>` + mk(c.fg, (S - mw) / 2, (S - mh) / 2, s), null, 'halmic'));
  write(`mark-${cn}.svg`, doc(MARK.w, MARK.h, mk(c.fg), null, 'halmic'));
}


// construction diagram (recommended direction c): guides for baseline, x-height, ascender, bar thickness, lean
{
  const w = wordmark('c'), pad = 60, W = w.w + pad * 2, H = B + pad * 2;
  const g = (y, label) => `<line x1="0" x2="${f(W)}" y1="${f(y + pad)}" y2="${f(y + pad)}" stroke="#3d7bff" stroke-width="1" stroke-dasharray="6 5"/><text x="4" y="${f(y + pad - 5)}" font-family="system-ui,sans-serif" font-size="13" fill="#3d7bff">${label}</text>`;
  const lean = `<line x1="${f(pad + 20 + SK * B)}" y1="${f(pad)}" x2="${f(pad + 20)}" y2="${f(pad + B)}" stroke="#e8b04a" stroke-width="1" stroke-dasharray="3 4"/>`;
  const body = `<g fill="#f1ece1" fill-opacity=".92" transform="translate(${pad} ${pad})">${w.ds.map((d) => pathTag(d)).join('')}</g>` +
    g(0, 'ascender 235.02') + g(XT, 'x-height 148.21') + g(B, 'baseline') + lean +
    `<text x="${f(pad + 30 + SK * B)}" y="${f(pad - 12)}" font-family="system-ui,sans-serif" font-size="13" fill="#e8b04a">lean 13 deg</text>` +
    `<text x="${pad}" y="${f(H - 14)}" font-family="system-ui,sans-serif" font-size="13" fill="#9a968e">bar T = 53.0, cap radius 26.5, dot = T, i-bar 140.54, gap 41.5</text>`;
  write('construction-c.svg', doc(W, H, body, '#0f0e13', 'halmic construction'));
}


// ---------- spacing proof: tint the white between letters, label each with its measured mean gap ----------
const proofRows = {};
function proof(dir, mode) {
  const w = wordmark(dir, { mode }), pad = 40, Wd = w.w + pad * 2, Ht = B + pad + 70;
  let tint = '', labels = '';
  w.parts.forEach((p, i) => {
    if (!i) return;
    const q = w.parts[i - 1], dxL = q.dx - w.x0, dxR = p.dx - w.x0;
    for (let j = 0; j < q.g.band.max.length; j += 2) {
      const a = q.g.band.max[j] + dxL, b2 = p.g.band.min[j] + dxR;
      if (!isFinite(a) || !isFinite(b2)) continue;
      const e = Math.min(b2, a + CAP);
      tint += `<rect x="${f(a + pad)}" y="${f(XT + j + pad)}" width="${f(Math.max(0, e - a))}" height="2.2" fill="#3d7bff" fill-opacity=".55"/>`;
    }
    const mid = (q.g.band.max.at(-1) + dxL + p.g.band.min.at(-1) + dxR) / 2 + pad;
    labels += `<text x="${f(mid)}" y="${f(B + pad + 40)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" fill="#f1ece1">${p.pair.mean.toFixed(1)}</text>`;
    (proofRows[`${dir}-${mode}`] ||= []).push({ pair: q.ch + p.ch, mean: +p.pair.mean.toFixed(1), min: +p.pair.min.toFixed(1) });
  });
  const body = `<g fill="#f1ece1" transform="translate(${pad} ${pad})">${w.ds.map((d) => pathTag(d)).join('')}</g>${tint}${labels}`;
  write(`spacing-proof-${dir}-${mode}.svg`, doc(Wd, Ht, body, '#0f0e13', `halmic spacing ${mode}`));
  const spread = Math.max(...proofRows[`${dir}-${mode}`].map((r) => r.mean)) - Math.min(...proofRows[`${dir}-${mode}`].map((r) => r.mean));
  proofRows[`${dir}-${mode}`].spread = +spread.toFixed(1);
  // plain wordmark of the before layout for the 24px comparison
  if (mode === 'fixed') write(`wordmark-${dir}-before.svg`, doc(w.w, w.h, `<g fill="#0f0e13">${w.ds.map((d) => pathTag(d)).join('')}</g>`, null, 'halmic'));
}
for (const dir of Object.keys(DIRECTIONS)) { proof(dir, 'fixed'); proof(dir, 'optical'); }
console.log(JSON.stringify(proofRows), JSON.stringify(lockGap));
fs.writeFileSync(path.join(here, 'spacing.json'), JSON.stringify({ capUnits: CAP, floor: FLOOR, note: 'mean white per scanline across the x-height band, in design units (bar = 53)', rows: proofRows, lockupGap: lockGap }, null, 2));

fs.writeFileSync(path.join(here, 'wordmark-parts.json'), JSON.stringify(Object.fromEntries(Object.keys(DIRECTIONS).map((k) => { const w = wordmark(k); return [k, { w: +f(w.w), h: w.h, groups: w.groups }]; }))));
fs.writeFileSync(path.join(here, 'geometry.json'), JSON.stringify({
  thickness: T, capRadius: R, leanDegrees: 13, ascender: B, xHeight: XH, bangBar: BANG, dot: T,
  directions: Object.fromEntries(Object.entries(DIRECTIONS).map(([k, v]) => { const w = wordmark(k); return [k, { ...v, width: +f(w.w), height: +f(w.h) }]; })),
  files: Object.keys(manifest),
}, null, 2));
console.log('wrote', Object.keys(manifest).length, 'svgs');
