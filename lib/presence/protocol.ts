// Shared presence wire protocol (compact JSON). DOM-free: imported by both the
// Durable Object (worker/presence-room.ts) and the browser client.
//
// Coordinates are viewport-normalized and quantized to integers 0..COORD_MAX.

export const COORD_MAX = 10000
export const COLOR_COUNT = 6
export const MAX_PTS_PER_MSG = 40
export const MAX_MSG_BYTES = 1024

/** client -> server */
export type ClientMsg = { t: 'm'; p: [number, number][] }

export interface PeerInfo {
  id: string
  color: number // 1..COLOR_COUNT
}

/** server -> client */
export type ServerMsg =
  | { t: 'welcome'; id: string; color: number; peers: PeerInfo[]; n: number; ro?: 1 }
  | { t: 'join'; id: string; color: number; n: number }
  | { t: 'leave'; id: string; n: number }
  | { t: 'move'; id: string; p: [number, number][] }
