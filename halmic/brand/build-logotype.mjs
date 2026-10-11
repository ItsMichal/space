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
const T = 53, R = T / 2;
const B = 235.02;            // baseline / full height
const XH = 148.21;           // x-height (short bar)
const XT = B - XH;           // y of x-height line
const BANG = 140.54;         // the "!" bar height
const LEAN = 13 * Math.PI / 180, SK = Math.tan(LEAN);
const f = (n) => (Math.round(n * 100) / 100).toString();

// ---------- path primitives (upright space, y down) ----------
const P = (x, y) => [x, y];
function arc(ops, cx, cy, r, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const da = (a1 - a0) / n, k = (4 / 3) * Math.tan(da / 4);
  for (let i = 0; i < n; i++) {
    const s = a0 + i * da, e = s + da;
    const p1 = [cx + r * (Math.cos(s) - k * Math.sin(s)), cy + r * (Math.sin(s) + k * Math.cos(s))];
    const p2 = [cx + r * (Math.cos(e) + k * Math.sin(e)), cy + r * (Math.sin(e) - k * Math.cos(e))];
    ops.push(['C', p1, p2, [cx + r * Math.cos(e), cy + r * Math.sin(e)]]);
  }
}
const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
function capsule(p0, p1) {
  const ph = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const ops = [['M', pol(...p0, R, ph + Math.PI / 2)], ['L', pol(...p1, R, ph + Math.PI / 2)]];
  arc(ops, p1[0], p1[1], R, ph + Math.PI / 2, ph - Math.PI / 2);
  ops.push(['L', pol(...p0, R, ph - Math.PI / 2)]);
  arc(ops, p0[0], p0[1], R, ph - Math.PI / 2, ph - 3 * Math.PI / 2);
  ops.push(['Z']);
  return ops;
}
// ring stroke along a circle (centerline radius rc) from a0 to a1; a1 > a0 sweeps clockwise on screen
function ring(cx, cy, rc, a0, a1) {
  const ops = [['M', pol(cx, cy, rc + R, a0)]];
  arc(ops, cx, cy, rc + R, a0, a1);
  const E = pol(cx, cy, rc, a1), S = pol(cx, cy, rc, a0);
  arc(ops, E[0], E[1], R, a1, a1 + Math.PI);
  arc(ops, cx, cy, rc - R, a1, a0);
  arc(ops, S[0], S[1], R, a0 + Math.PI, a0 + 2 * Math.PI);
  ops.push(['Z']);
  return ops;
}
const dot = (cx, cy) => { const o = [['M', [cx + R, cy]]]; arc(o, cx, cy, R, 0, Math.PI * 2); o.push(['Z']); return o; };
const stem = (x, yTop, yBot) => capsule([x, yTop + R], [x, yBot - R]);   // outer extent yTop..yBot

// ---------- shear + emit ----------
const sh = ([x, y]) => [x + SK * (B - y), y];
function dOf(ops, dx = 0) {
  return ops.map((o) => {
    if (o[0] === 'Z') return 'Z';
    const pts = o.slice(1).map((p) => { const q = sh(p); return f(q[0] + dx) + ',' + f(q[1]); });
    return o[0] + pts.join(' ');
  }).join('');
}
function bbox(shapes, dx = 0) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const ops of shapes) {
    let cur = null;
    for (const o of ops) {
      if (o[0] === 'Z') continue;
      if (o[0] === 'M' || o[0] === 'L') { cur = o[1]; add(cur); }
      else { const p = [cur, o[1], o[2], o[3]]; for (let t = 0; t <= 1; t += 0.02) {
        const u = 1 - t; add([0, 1].map((i) => u*u*u*p[0][i] + 3*u*u*t*p[1][i] + 3*u*t*t*p[2][i] + t*t*t*p[3][i])); } cur = o[3]; }
    }
  }
  function add(p) { const q = sh(p); x0 = Math.min(x0, q[0] + dx); x1 = Math.max(x1, q[0] + dx); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  return { x0, x1, y0, y1 };
}

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

// pair adjustments (optical, in upright units); round bowls sit closer to stems
function layout(v, text = 'halmic') {
  const L = makeLetters(v);
  let x = 0; const parts = []; let prev = null;
  for (const ch of text) {
    const g = L[ch](); let kern = 0;
    if (prev) {
      kern = v.gap;
      if (prev.bowl && !prev.open && !g.bowl) kern -= 6;       // a|stem
      if (g.bowl && !prev.bowl) kern -= 4;
      if (prev.open && g.bowl) kern -= 0;
    }
    x += kern; parts.push({ ch, shapes: g.shapes, dx: x }); x += g.adv; prev = g;
  }
  return parts;
}

function wordmark(dir, o = {}) {
  const v = DIRECTIONS[dir], parts = layout(v), all = [];
  const shift = [];
  for (const p of parts) for (const s of p.shapes) { all.push(s); shift.push(p.dx); }
  // bbox with per-shape dx
  let x0 = 1e9, x1 = -1e9;
  all.forEach((s, i) => { const b = bbox([s], shift[i]); x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); });
  const ds = all.map((s, i) => dOf(s, shift[i] - x0));
  let k = 0;
  const groups = parts.map((p) => ({ ch: p.ch, ds: p.shapes.map(() => ds[k++]) }));
  return { w: x1 - x0, h: B, ds, groups, letters: parts.map((p) => p.ch) };
}

// ---------- mark (reused verbatim) ----------
const markSrc = fs.readFileSync(path.join(here, 'mark.svg'), 'utf8');
const markPaths = [...markSrc.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);
const MARK = { w: 349.92, h: 235.02 };

// ---------- svg assembly ----------
const COLORS = {
  ink: { fg: '#0f0e13', bg: '#f1ece1' },
  paper: { fg: '#f1ece1', bg: '#0f0e13' },
  accent: { fg: '#ff4d2e', bg: '#0f0e13' },
};
const pathTag = (d, fill) => `<path d="${d}"${fill ? ` fill="${fill}"` : ''}/>`;
const wm = (dir, fill, tx = 0, ty = 0) => {
  const w = wordmark(dir);
  return { w: w.w, h: w.h, body: `<g fill="${fill}" transform="translate(${f(tx)} ${f(ty)})">${w.ds.map((d) => pathTag(d)).join('')}</g>` };
};
const mk = (fill, tx = 0, ty = 0, s = 1) => `<g fill="${fill}" transform="translate(${f(tx)} ${f(ty)})${s !== 1 ? ` scale(${s})` : ''}">${markPaths.map((d) => pathTag(d)).join('')}</g>`;
const doc = (w, h, body, bg, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" role="img" aria-label="${title}"><title>${title}</title>${bg ? `<rect width="${f(w)}" height="${f(h)}" fill="${bg}"/>` : ''}${body}</svg>\n`;

const GAP_LOCKUP = 2.0 * T;            // mark to word: two bar thicknesses
const out = path.join(here, 'svg');
fs.mkdirSync(out, { recursive: true });
const manifest = {};
function write(name, svg) { fs.writeFileSync(path.join(out, name), svg); manifest[name] = true; }

for (const dir of Object.keys(DIRECTIONS)) {
  for (const [cn, c] of Object.entries(COLORS)) {
    const w = wm(dir, c.fg);
    write(`wordmark-${dir}-${cn}.svg`, doc(w.w, w.h, w.body, null, 'halmic'));
    // horizontal lockup, mark at 1:1 beside wordmark at 1:1 (same bar thickness)
    const wl = wm(dir, c.fg, MARK.w + GAP_LOCKUP, 0);
    write(`lockup-h-${dir}-${cn}.svg`, doc(MARK.w + GAP_LOCKUP + wl.w, B, mk(c.fg) + wl.body, null, 'halmic'));
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
  const g = (y, label) => `<line x1="0" x2="${f(W)}" y1="${f(y + pad)}" y2="${f(y + pad)}" stroke="#ff4d2e" stroke-width="1" stroke-dasharray="6 5"/><text x="4" y="${f(y + pad - 5)}" font-family="system-ui,sans-serif" font-size="13" fill="#ff4d2e">${label}</text>`;
  const lean = `<line x1="${f(pad + 20 + SK * B)}" y1="${f(pad)}" x2="${f(pad + 20)}" y2="${f(pad + B)}" stroke="#8fa3ff" stroke-width="1" stroke-dasharray="3 4"/>`;
  const body = `<g fill="#f1ece1" fill-opacity=".92" transform="translate(${pad} ${pad})">${w.ds.map((d) => pathTag(d)).join('')}</g>` +
    g(0, 'ascender 235.02') + g(XT, 'x-height 148.21') + g(B, 'baseline') + lean +
    `<text x="${f(pad + 30 + SK * B)}" y="${f(pad - 12)}" font-family="system-ui,sans-serif" font-size="13" fill="#8fa3ff">lean 13 deg</text>` +
    `<text x="${pad}" y="${f(H - 14)}" font-family="system-ui,sans-serif" font-size="13" fill="#9a968e">bar T = 53.0, cap radius 26.5, dot = T, i-bar 140.54, gap 41.5</text>`;
  write('construction-c.svg', doc(W, H, body, '#0f0e13', 'halmic construction'));
}

fs.writeFileSync(path.join(here, 'wordmark-parts.json'), JSON.stringify(Object.fromEntries(Object.keys(DIRECTIONS).map((k) => { const w = wordmark(k); return [k, { w: +f(w.w), h: w.h, groups: w.groups }]; }))));
fs.writeFileSync(path.join(here, 'geometry.json'), JSON.stringify({
  thickness: T, capRadius: R, leanDegrees: 13, ascender: B, xHeight: XH, bangBar: BANG, dot: T,
  directions: Object.fromEntries(Object.entries(DIRECTIONS).map(([k, v]) => { const w = wordmark(k); return [k, { ...v, width: +f(w.w), height: +f(w.h) }]; })),
  files: Object.keys(manifest),
}, null, 2));
console.log('wrote', Object.keys(manifest).length, 'svgs');
