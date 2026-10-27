export const MU: number
export const RE: number
export const J2: number
export const EARTH_R_VIS: number
export const TAU: number
export const MAGIC: number
export const VERSION: number
export const HEADER_BYTES: number
export const FLOATS_PER_SAT: number
export const MAX_AGE_DAYS: number
export const IDS_MAGIC: number
export const IDS_VERSION: number
export const ID_BYTES: number

export interface Omm {
  OBJECT_NAME?: string
  EPOCH: string
  MEAN_MOTION: number
  ECCENTRICITY: number
  INCLINATION: number
  RA_OF_ASC_NODE: number
  ARG_OF_PERICENTER: number
  MEAN_ANOMALY: number
  [k: string]: unknown
}
export interface Elements {
  inc: number
  raan: number
  u: number
  udot: number
  udd: number
}
export interface Packed {
  count: number
  refEpoch: number
  /** inc, raan, u, udot, udd per satellite */
  data: Float32Array
}
export interface Identities {
  norad: Uint32Array
  name: Uint32Array
  /** year * 1000 + launch of the year */
  launch: Uint32Array
}
export function identityOf(omm: Omm): { norad: number; name: number; launch: number }
export function nameOf(n: number): string | null

export function epochSeconds(s: string): number
export function gmst(unixSec: number): number
export function elementsAt(omm: Omm, refSec: number): Elements | null
export function packOmm(list: Omm[], refEpoch?: number): { bytes: Uint8Array; ids: Uint8Array; count: number; refEpoch: number }
export function packIds(list: { norad: number; name: number; launch: number }[], ref: number): Uint8Array
export function unpackIds(buf: ArrayBuffer | Uint8Array, packed: Packed | null): Identities | null
export function unpack(buf: ArrayBuffer | Uint8Array): Packed | null
export function isStale(refEpoch: number, nowMs: number): boolean
export function radiusOf(udot: number): number
export function positionEcef(data: Float32Array, i: number, refEpoch: number, tSec: number): [number, number, number]
export function subPoint(data: Float32Array, i: number, refEpoch: number, tSec: number): { lat: number; lon: number }
