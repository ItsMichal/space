// shared geometry for the halmic brand scripts (see build-logotype.mjs for the measurements)
export const T = 53, R = T / 2;
export const B = 235.02;            // baseline / full height
export const XH = 148.21;           // x-height (short bar)
export const XT = B - XH;           // y of x-height line
export const BANG = 140.54;         // the "!" bar height
export const LEAN = 13 * Math.PI / 180, SK = Math.tan(LEAN);
export const f = (n) => (Math.round(n * 100) / 100).toString();

// ---------- path primitives (upright space, y down) ----------
export const P = (x, y) => [x, y];
export function arc(ops, cx, cy, r, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const da = (a1 - a0) / n, k = (4 / 3) * Math.tan(da / 4);
  for (let i = 0; i < n; i++) {
    const s = a0 + i * da, e = s + da;
    const p1 = [cx + r * (Math.cos(s) - k * Math.sin(s)), cy + r * (Math.sin(s) + k * Math.cos(s))];
    const p2 = [cx + r * (Math.cos(e) + k * Math.sin(e)), cy + r * (Math.sin(e) - k * Math.cos(e))];
    ops.push(['C', p1, p2, [cx + r * Math.cos(e), cy + r * Math.sin(e)]]);
  }
}
export const pol = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
export function capsule(p0, p1) {
  const ph = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const ops = [['M', pol(...p0, R, ph + Math.PI / 2)], ['L', pol(...p1, R, ph + Math.PI / 2)]];
  arc(ops, p1[0], p1[1], R, ph + Math.PI / 2, ph - Math.PI / 2);
  ops.push(['L', pol(...p0, R, ph - Math.PI / 2)]);
  arc(ops, p0[0], p0[1], R, ph - Math.PI / 2, ph - 3 * Math.PI / 2);
  ops.push(['Z']);
  return ops;
}
// ring stroke along a circle (centerline radius rc) from a0 to a1; a1 > a0 sweeps clockwise on screen
export function ring(cx, cy, rc, a0, a1) {
  const ops = [['M', pol(cx, cy, rc + R, a0)]];
  arc(ops, cx, cy, rc + R, a0, a1);
  const E = pol(cx, cy, rc, a1), S = pol(cx, cy, rc, a0);
  arc(ops, E[0], E[1], R, a1, a1 + Math.PI);
  arc(ops, cx, cy, rc - R, a1, a0);
  arc(ops, S[0], S[1], R, a0 + Math.PI, a0 + 2 * Math.PI);
  ops.push(['Z']);
  return ops;
}
export const dot = (cx, cy) => { const o = [['M', [cx + R, cy]]]; arc(o, cx, cy, R, 0, Math.PI * 2); o.push(['Z']); return o; };
export const stem = (x, yTop, yBot) => capsule([x, yTop + R], [x, yBot - R]);   // outer extent yTop..yBot

// ---------- shear + emit ----------
export const sh = ([x, y]) => [x + SK * (B - y), y];
export function dOf(ops, dx = 0) {
  return ops.map((o) => {
    if (o[0] === 'Z') return 'Z';
    const pts = o.slice(1).map((p) => { const q = sh(p); return f(q[0] + dx) + ',' + f(q[1]); });
    return o[0] + pts.join(' ');
  }).join('');
}
export function bbox(shapes, dx = 0) {
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

