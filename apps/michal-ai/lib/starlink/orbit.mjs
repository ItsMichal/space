// Starlink constellation: OMM (CelesTrak SupGP JSON) -> compact binary -> positions. Shared by the Node build script, the
// Worker cron and the browser; plain ESM with a hand-written .d.mts so all three can import it. Mirrored 1:1 by the vertex
// shader in components/presence/globe/satellites.ts (see docs/globe.md for the maths).
//
// Model: every satellite is a circular orbit (Starlink e ~ 1e-4) with J2 secular drift. Stored per satellite, at one common
// reference epoch: inclination i, RAAN, argument of latitude u (= argp + mean anomaly) and its rate udot (rad/s). From those:
//   u(t)  = u + udot t + udd t^2 / 2                 udd: drag (from MEAN_MOTION_DOT), rad/s^2
//   a     = (MU / udot^2)^(1/3)                      orbit radius (km)
//   dRAAN = -1.5 J2 (RE / a)^2 udot cos i            J2 nodal precession (rad/s)
//   ECI   = Rz(RAAN) Rx(i) [r cos u, r sin u, 0]
//   ECEF  = Rz(-GMST) ECI, which for a circular orbit is the same orbit with RAAN' = RAAN - GMST.

export const MU = 398600.8 // km^3/s^2 (WGS-72, what SGP4 uses)
export const RE = 6378.135 // km (WGS-72 equatorial radius)
export const J2 = 0.001082616
export const EARTH_R_VIS = 6371 // km, the radius the drawn globe stands for
export const TAU = Math.PI * 2
export const MAGIC = 0x4b4e4c53 // "SLNK"
export const VERSION = 1
export const HEADER_BYTES = 20
export const FLOATS_PER_SAT = 5
export const MAX_AGE_DAYS = 30
/**
 * Identities live in a separate sidecar file so the constellation file keeps its exact v1 layout (clients already in the
 * wild read it with a strict length check). Sidecar: magic "SLID", u16 version, u16 reserved, u32 count, f64 reference epoch
 * (both equal to the constellation file it belongs to), then ID_BYTES per satellite in the same order: u32 NORAD number,
 * u32 name number (top bit = "[DTC]"), u32 launch (year * 1000 + launch of the year).
 */
export const IDS_MAGIC = 0x44494c53 // "SLID"
export const IDS_VERSION = 1
export const ID_BYTES = 12
const DTC = 0x80000000
export const MIN_REV_PER_DAY = 14.5
export const MAX_REV_PER_DAY = 16.5

const D2R = Math.PI / 180

/** Parse an OMM EPOCH ("2026-10-12T06:40:42.000010", UTC without a zone) to unix seconds. */
export function epochSeconds(s) {
  return Date.parse(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z') / 1000
}

/** Greenwich mean sidereal time in radians for unix seconds (IAU-82 polynomial, UT1 taken as UTC). */
export function gmst(unixSec) {
  const d = unixSec / 86400 + 2440587.5 - 2451545.0
  const T = d / 36525
  const deg = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000
  return ((((deg % 360) + 360) % 360) * Math.PI) / 180
}

/** SGP4's un-Kozai step: the TLE mean motion (rad/min) -> the Brouwer mean motion the propagator actually uses. */
function brouwerN(n0Rad, inc, ecc) {
  const KE = 60 / Math.sqrt((RE * RE * RE) / MU) // sqrt(mu) in Earth radii^1.5 / min
  const ck2 = 0.5 * J2
  const c = Math.cos(inc)
  const x3thm1 = 3 * c * c - 1
  const beta2 = 1 - ecc * ecc
  const a1 = Math.pow(KE / n0Rad, 2 / 3)
  const d1 = (0.75 * J2 * x3thm1) / (a1 * a1 * beta2 * Math.sqrt(beta2))
  const ao = a1 * (1 - d1 / 3 - d1 * d1 - (134 / 81) * d1 * d1 * d1)
  const dO = (0.75 * J2 * x3thm1) / (ao * ao * beta2 * Math.sqrt(beta2))
  void ck2
  return n0Rad / (1 + dO)
}

/**
 * One OMM record -> elements at `refSec`, or null when it is not a usable on-station orbit.
 * Secular rates follow SGP4 (first order in J2); the element epoch is propagated to the reference epoch with them.
 */
export function elementsAt(omm, refSec) {
  const nRevDay = Number(omm.MEAN_MOTION)
  const ecc = Number(omm.ECCENTRICITY)
  const incDeg = Number(omm.INCLINATION)
  if (!(nRevDay >= MIN_REV_PER_DAY && nRevDay <= MAX_REV_PER_DAY) || !(ecc < 0.02) || !Number.isFinite(incDeg)) return null
  const epoch = epochSeconds(String(omm.EPOCH))
  const raan = Number(omm.RA_OF_ASC_NODE) * D2R
  const argp = Number(omm.ARG_OF_PERICENTER) * D2R
  const m = Number(omm.MEAN_ANOMALY) * D2R
  if (!Number.isFinite(epoch) || !Number.isFinite(raan + argp + m)) return null
  const inc = incDeg * D2R
  const nKozai = (nRevDay * TAU) / 1440 // rad/min
  const n0 = brouwerN(nKozai, inc, ecc) // rad/min, Earth radii^1.5 units
  const a = Math.pow(((60 / Math.sqrt((RE * RE * RE) / MU)) / n0), 2 / 3) // Earth radii
  const k = J2 / (a * a * (1 - ecc * ecc) * (1 - ecc * ecc))
  const c = Math.cos(inc)
  const beta = Math.sqrt(1 - ecc * ecc)
  const nodeDot = -1.5 * k * n0 * c
  const argpDot = 0.75 * k * n0 * (5 * c * c - 1)
  const mDot = n0 * (1 + 0.75 * k * beta * (3 * c * c - 1))
  const dt = refSec - epoch // s
  const wrap = (x) => ((x % TAU) + TAU) % TAU
  const udot = (argpDot + mDot) / 60 // rad/s
  // TLE field MEAN_MOTION_DOT is (d n / dt) / 2 in rev/day^2; as rad/s^2 of the argument of latitude:
  const nd = Number(omm.MEAN_MOTION_DOT)
  const udd = Number.isFinite(nd) ? (2 * nd * TAU) / (86400 * 86400) : 0
  return {
    inc,
    raan: wrap(raan + (nodeDot / 60) * dt),
    u: wrap(argp + m + udot * dt + 0.5 * udd * dt * dt),
    udot: udot + udd * dt,
    udd,
  }
}

/**
 * Pack OMM records. Returns { bytes, ids, count, refEpoch }: `bytes` is the constellation file, `ids` its identity sidecar.
 * `refEpoch` defaults to the newest element epoch.
 */
export function packOmm(list, refEpoch) {
  const ok = []
  let newest = 0
  for (const o of list) {
    const e = epochSeconds(String(o.EPOCH))
    if (Number.isFinite(e) && e > newest) newest = e
  }
  const ref = refEpoch ?? Math.floor(newest)
  const ids = []
  for (const o of list) {
    const el = elementsAt(o, ref)
    if (el) {
      ok.push(el)
      ids.push(identityOf(o))
    }
  }
  const bytes = new Uint8Array(HEADER_BYTES + ok.length * FLOATS_PER_SAT * 4)
  const dv = new DataView(bytes.buffer)
  dv.setUint32(0, MAGIC, true)
  dv.setUint16(4, VERSION, true)
  dv.setUint16(6, 0, true)
  dv.setUint32(8, ok.length, true)
  dv.setFloat64(12, ref, true)
  ok.forEach((e, i) => {
    const o = HEADER_BYTES + i * FLOATS_PER_SAT * 4
    dv.setFloat32(o, e.inc, true)
    dv.setFloat32(o + 4, e.raan, true)
    dv.setFloat32(o + 8, e.u, true)
    dv.setFloat32(o + 12, e.udot, true)
    dv.setFloat32(o + 16, e.udd, true)
  })
  return { bytes, ids: packIds(ids, ref), count: ok.length, refEpoch: ref }
}

/** The identity sidecar for `list` (from identityOf, in constellation order) at reference epoch `ref`. */
export function packIds(list, ref) {
  const bytes = new Uint8Array(HEADER_BYTES + list.length * ID_BYTES)
  const dv = new DataView(bytes.buffer)
  dv.setUint32(0, IDS_MAGIC, true)
  dv.setUint16(4, IDS_VERSION, true)
  dv.setUint16(6, 0, true)
  dv.setUint32(8, list.length, true)
  dv.setFloat64(12, ref, true)
  list.forEach((d, i) => {
    const o = HEADER_BYTES + i * ID_BYTES
    dv.setUint32(o, d.norad, true)
    dv.setUint32(o + 4, d.name, true)
    dv.setUint32(o + 8, d.launch, true)
  })
  return bytes
}

/**
 * Read an identity sidecar. Returns null unless it is a v1 sidecar for exactly `packed` (same count and reference epoch), so a
 * sidecar from another refresh is never paired with the wrong satellites.
 */
export function unpackIds(buf, packed) {
  const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  if (!packed || ab.byteLength < HEADER_BYTES) return null
  const dv = new DataView(ab)
  if (dv.getUint32(0, true) !== IDS_MAGIC || dv.getUint16(4, true) !== IDS_VERSION) return null
  const count = dv.getUint32(8, true)
  if (count !== packed.count || dv.getFloat64(12, true) !== packed.refEpoch) return null
  if (ab.byteLength !== HEADER_BYTES + count * ID_BYTES) return null
  const ids = { norad: new Uint32Array(count), name: new Uint32Array(count), launch: new Uint32Array(count) }
  for (let i = 0; i < count; i++) {
    const o = HEADER_BYTES + i * ID_BYTES
    ids.norad[i] = dv.getUint32(o, true)
    ids.name[i] = dv.getUint32(o + 4, true)
    ids.launch[i] = dv.getUint32(o + 8, true)
  }
  return ids
}

/**
 * What the OMM says about who a satellite is, as three integers: the NORAD catalogue number, the number in its name
 * ("STARLINK-1234" -> 1234, with the top bit set for a "[DTC]" direct-to-cell satellite) and its launch as year * 1000 + launch
 * of the year (OBJECT_ID "2019-074A" -> 2019074). 0 where the field is missing or not in that form.
 */
export function identityOf(omm) {
  const norad = Number(omm.NORAD_CAT_ID)
  const nm = /^STARLINK-(\d{1,9})(\s*\[DTC\])?$/.exec(String(omm.OBJECT_NAME ?? '').trim())
  const num = nm ? Number(nm[1]) : 0
  const id = /^(\d{4})-(\d{3})/.exec(String(omm.OBJECT_ID ?? ''))
  return {
    norad: Number.isInteger(norad) && norad > 0 && norad < DTC ? norad : 0,
    name: num > 0 && num < DTC ? (num | (nm && nm[2] ? DTC : 0)) >>> 0 : 0,
    launch: id ? Number(id[1]) * 1000 + Number(id[2]) : 0,
  }
}

/** Decode the name field of the identity trailer: "STARLINK-1234", "STARLINK-1234 [DTC]", or null. */
export function nameOf(n) {
  if (!n) return null
  const num = n & 0x7fffffff
  return `STARLINK-${num}${n & DTC ? ' [DTC]' : ''}`
}

/** Read a packed buffer. Returns null for anything that is not a version-1 constellation file. */
export function unpack(buf) {
  const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  if (ab.byteLength < HEADER_BYTES) return null
  const dv = new DataView(ab)
  if (dv.getUint32(0, true) !== MAGIC || dv.getUint16(4, true) !== VERSION) return null
  const count = dv.getUint32(8, true)
  if (ab.byteLength !== HEADER_BYTES + count * FLOATS_PER_SAT * 4) return null
  const refEpoch = dv.getFloat64(12, true)
  // Little-endian on every platform that runs a browser; DataView copy keeps this correct elsewhere too.
  const data = new Float32Array(count * FLOATS_PER_SAT)
  for (let i = 0; i < data.length; i++) data[i] = dv.getFloat32(HEADER_BYTES + i * 4, true)
  return { count, refEpoch, data }
}

/** True when the elements are too old to draw (reference epoch more than 30 days before `nowMs`, or in the future by > 1 day). */
export function isStale(refEpoch, nowMs) {
  const age = nowMs / 1000 - refEpoch
  return !Number.isFinite(age) || age > MAX_AGE_DAYS * 86400 || age < -86400
}

/** Orbit radius in drawn-globe radii (true scale) from the angular rate. */
export function radiusOf(udot) {
  return Math.pow(MU / (udot * udot), 1 / 3) / EARTH_R_VIS
}

/**
 * Earth-fixed position (x towards lon 0 lat 0, y towards lon 90E, z north) in drawn-globe radii for satellite `i` of
 * `data` at unix time `tSec`. The JS mirror of the vertex shader.
 */
export function positionEcef(data, i, refEpoch, tSec) {
  const inc = data[i * 5]
  const raan0 = data[i * 5 + 1]
  const u0 = data[i * 5 + 2]
  const udot = data[i * 5 + 3]
  const udd = data[i * 5 + 4]
  const t = tSec - refEpoch
  const aKm = Math.pow(MU / (udot * udot), 1 / 3)
  const k = J2 * (RE / aKm) * (RE / aKm)
  const raan = raan0 - 1.5 * k * udot * Math.cos(inc) * t - gmst(tSec)
  const u = u0 + udot * t + 0.5 * udd * t * t
  const r = aKm / EARTH_R_VIS
  const cr = Math.cos(raan)
  const sr = Math.sin(raan)
  const cu = Math.cos(u)
  const su = Math.sin(u)
  const ci = Math.cos(inc)
  return [r * (cr * cu - sr * su * ci), r * (sr * cu + cr * su * ci), r * su * Math.sin(inc)]
}

/** Sub-satellite geocentric latitude / east longitude in degrees. */
export function subPoint(data, i, refEpoch, tSec) {
  const [x, y, z] = positionEcef(data, i, refEpoch, tSec)
  return { lat: Math.atan2(z, Math.hypot(x, y)) / D2R, lon: Math.atan2(y, x) / D2R }
}
