// Optical spacing: measure the white between adjacent letters along horizontal scanlines
// (equal to the gap measured along the slant, because every stem is sheared by the same lean),
// then place each letter so the mean white per scanline is equal, weighted by the side shapes.
import { sh } from './lib.mjs';

const cubic = (p, t) => { const u = 1 - t; return [0, 1].map((i) => u*u*u*p[0][i] + 3*u*u*t*p[1][i] + 3*u*t*t*p[2][i] + t*t*t*p[3][i]); };

// ops (upright space) -> polygons in sheared space
export function flatten(ops, shear = true) {
  const polys = []; let cur = null, poly = null; const tf = shear ? sh : (p) => p;
  for (const o of ops) {
    if (o[0] === 'M') { poly = [tf(o[1])]; polys.push(poly); cur = o[1]; }
    else if (o[0] === 'L') { poly.push(tf(o[1])); cur = o[1]; }
    else if (o[0] === 'C') { const p = [cur, o[1], o[2], o[3]]; for (let k = 1; k <= 20; k++) poly.push(tf(cubic(p, k / 20))); cur = o[3]; }
  }
  return polys;
}

// SVG path data (the mark) -> polygons; supports M m L l H h V v C c Z z
export function parsePath(d) {
  const polys = []; let poly = null, x = 0, y = 0, sx = 0, sy = 0;
  const toks = [...d.matchAll(/([MmLlHhVvCcZz])([^MmLlHhVvCcZz]*)/g)];
  for (const [, c, a] of toks) {
    const n = (a.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    const rel = c === c.toLowerCase(), C = c.toUpperCase();
    if (C === 'Z') { x = sx; y = sy; continue; }
    if (C === 'M') { x = rel ? x + n[0] : n[0]; y = rel ? y + n[1] : n[1]; sx = x; sy = y; poly = [[x, y]]; polys.push(poly); for (let i = 2; i < n.length; i += 2) { x = rel ? x + n[i] : n[i]; y = rel ? y + n[i + 1] : n[i + 1]; poly.push([x, y]); } }
    else if (C === 'L') for (let i = 0; i < n.length; i += 2) { x = rel ? x + n[i] : n[i]; y = rel ? y + n[i + 1] : n[i + 1]; poly.push([x, y]); }
    else if (C === 'H') for (const v of n) { x = rel ? x + v : v; poly.push([x, y]); }
    else if (C === 'V') for (const v of n) { y = rel ? y + v : v; poly.push([x, y]); }
    else if (C === 'C') for (let i = 0; i < n.length; i += 6) {
      const p = [[x, y], [rel ? x + n[i] : n[i], rel ? y + n[i + 1] : n[i + 1]], [rel ? x + n[i + 2] : n[i + 2], rel ? y + n[i + 3] : n[i + 3]], [rel ? x + n[i + 4] : n[i + 4], rel ? y + n[i + 5] : n[i + 5]]];
      for (let k = 1; k <= 20; k++) poly.push(cubic(p, k / 20)); [x, y] = p[3];
    }
  }
  return polys;
}

// left/right ink extents per scanline in [y0, y1)
export function profile(polys, y0, y1, step = 1) {
  const n = Math.floor((y1 - y0) / step), min = new Float64Array(n).fill(Infinity), max = new Float64Array(n).fill(-Infinity);
  for (const poly of polys) {
    for (let i = 0; i < n; i++) {
      const yc = y0 + (i + 0.5) * step, xs = [];
      for (let j = 0; j < poly.length; j++) {
        const a = poly[j], b = poly[(j + 1) % poly.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      if (xs.length >= 2) { xs.sort((p, q) => p - q); min[i] = Math.min(min[i], xs[0]); max[i] = Math.max(max[i], xs[xs.length - 1]); }
    }
  }
  return { min, max, y0, step };
}

// mean white per scanline between two profiles when the right one is shifted by d (capped per line)
export function meanGap(L, Rr, d, cap) {
  let sum = 0, n = 0;
  for (let i = 0; i < L.max.length; i++) {
    if (!isFinite(L.max[i]) || !isFinite(Rr.min[i])) continue;
    sum += Math.min(cap, Rr.min[i] + d - L.max[i]); n++;
  }
  return n ? sum / n : 0;
}
export function minGap(L, Rr, d) {
  let m = Infinity;
  for (let i = 0; i < L.max.length; i++) if (isFinite(L.max[i]) && isFinite(Rr.min[i])) m = Math.min(m, Rr.min[i] + d - L.max[i]);
  return m;
}
export function solve(L, Rr, target, cap, floor = 0, fullL = null, fullR = null) {
  let lo = -600, hi = 1600;
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (meanGap(L, Rr, mid, cap) < target) lo = mid; else hi = mid; }
  let d = (lo + hi) / 2;
  const mg = minGap(fullL || L, fullR || Rr, d);
  if (mg < floor) d += floor - mg;        // never closer than the floor anywhere (keeps the i dot and round corners clear)
  return d;
}
