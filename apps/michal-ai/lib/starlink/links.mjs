// Laser-mesh neighbours for the hero globe: which satellites sit next to each other. Built once when the elements load (a few ms for
// about 11,000 satellites), never per frame. Satellites in one orbital plane share inclination and RAAN and stay in the same order
// of argument of latitude, so the table stays valid as they move; adjacent planes are matched by nearest argument of latitude.
//
// `data` is the packed element array (5 floats per satellite: inc, raan, u, udot, udd, see orbit.mjs). Returns two Int32Arrays,
// link i joins satellite a[i] and satellite b[i].

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Plane clusters per inclination group: [{ raan, idx: satellite indices sorted by argument of latitude }]. */
export function planes(data, count) {
  const order = Array.from({ length: count }, (_, i) => i)
  const bucket = (i) => Math.round((data[i * 5] / DEG) * 2) // half-degree inclination groups (one shell each)
  order.sort((p, q) => bucket(p) - bucket(q) || data[p * 5 + 1] - data[q * 5 + 1])
  const groups = []
  let cur = null
  let last = null
  for (const i of order) {
    const b = bucket(i)
    const raan = data[i * 5 + 1]
    if (!cur || cur.b !== b) {
      cur = { b, planes: [] }
      groups.push(cur)
      last = null
    }
    if (!last || raan - last.raan > 0.4 * DEG) {
      last = { raan, idx: [] }
      cur.planes.push(last)
    }
    last.raan = raan
    last.idx.push(i)
  }
  for (const g of groups) for (const p of g.planes) p.idx.sort((a, b) => data[a * 5 + 2] - data[b * 5 + 2])
  return groups
}

/** In-plane neighbours (ahead) and nearest argument-of-latitude matches in the next plane of the same shell. */
export function buildLinks(data, count, { maxGap = 22 * DEG, maxCross = 9 * DEG, crossEvery = 3 } = {}) {
  const A = []
  const B = []
  const u = (i) => data[i * 5 + 2]
  for (const g of planes(data, count)) {
    const ps = g.planes.filter((p) => p.idx.length >= 4)
    for (let pi = 0; pi < ps.length; pi++) {
      const idx = ps[pi].idx
      for (let k = 0; k < idx.length; k++) {
        const a = idx[k]
        const b = idx[(k + 1) % idx.length]
        const du = (u(b) - u(a) + TAU) % TAU
        if (du > 0 && du < maxGap) {
          A.push(a)
          B.push(b)
        }
      }
      const next = ps[(pi + 1) % ps.length]
      if (next === ps[pi] || Math.abs(next.raan - ps[pi].raan) > 12 * DEG) continue
      const nidx = next.idx
      for (let k = 0; k < idx.length; k += crossEvery) {
        const a = idx[k]
        // binary search the nearest u in the next plane
        let lo = 0
        let hi = nidx.length - 1
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (u(nidx[mid]) < u(a)) lo = mid + 1
          else hi = mid
        }
        let best = nidx[lo % nidx.length]
        const alt = nidx[(lo + nidx.length - 1) % nidx.length]
        const d = (j) => Math.abs(((u(j) - u(a) + Math.PI) % TAU + TAU) % TAU - Math.PI)
        if (d(alt) < d(best)) best = alt
        if (d(best) < maxCross) {
          A.push(a)
          B.push(best)
        }
      }
    }
  }
  return { a: Int32Array.from(A), b: Int32Array.from(B) }
}
