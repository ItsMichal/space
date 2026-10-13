// Shared by the Worker (validation) and the browser (rendering). DOM-free.

/** Emoji a visitor can pick to represent their visit. Wire ids; the glyph is only used for display. */
export const VISIT_EMOJI = [
  { id: 'sprout', glyph: '🌱', label: 'Sprout' },
  { id: 'leaf', glyph: '🌿', label: 'Leaf' },
  { id: 'tea', glyph: '☕', label: 'Tea' },
  { id: 'moon', glyph: '🌙', label: 'Moon' },
  { id: 'sun', glyph: '☀️', label: 'Sun' },
  { id: 'butterfly', glyph: '🦋', label: 'Butterfly' },
  { id: 'autumn', glyph: '🍂', label: 'Autumn leaf' },
  { id: 'book', glyph: '📖', label: 'Book' },
] as const
export type VisitEmojiId = (typeof VISIT_EMOJI)[number]['id']
export const VISIT_EMOJI_IDS: readonly string[] = VISIT_EMOJI.map((e) => e.id)
export const DEFAULT_VISIT_EMOJI: VisitEmojiId = 'sprout'

/** Fixed article reaction set. */
export const REACTIONS = [
  { id: 'clap', glyph: '👏', label: 'Applause' },
  { id: 'heart', glyph: '❤️', label: 'Love' },
  { id: 'fire', glyph: '🔥', label: 'Fire' },
  { id: 'mind', glyph: '🤯', label: 'Mind blown' },
  { id: 'sprout', glyph: '🌱', label: 'Sprout' },
] as const
export type ReactionId = (typeof REACTIONS)[number]['id']
export const REACTION_IDS: readonly string[] = REACTIONS.map((e) => e.id)

export const LIVE_LIMITS = {
  /** Snap grid in degrees (~55 km). */
  gridDeg: 0.5,
  /** Max deterministic jitter inside a grid cell, in degrees. */
  jitterDeg: 0.22,
  maxLive: 150,
  maxSocketsPerIp: 4,
  historyMax: 200,
  historyDays: 30,
  flushMs: 300,
  /** Client pings every 25 s; the room drops sockets quiet for longer than this. */
  idleMs: 90_000,
  maxMsgBytes: 256,
  msgPerWindow: 12,
  msgWindowMs: 10_000,
  /** Reactions: writes / reads per IP-hash per minute, per Durable Object. */
  reactWritesPerMin: 30,
  reactReadsPerMin: 120,
  /** Hard cap on stored reaction rows per post. */
  reactRowsMax: 50_000,
  /** Distinct highlight blocks tracked per post. */
  reactBlocksMax: 400,
  /** All reaction writes to one post, any client, per minute (per object). */
  reactPostWritesPerMin: 600,
  /** View writes: per client (salted IP hash) and for the whole post, per minute. */
  viewWritesPerMin: 20,
  viewPostWritesPerMin: 300,
  /** Visitors remembered per post per UTC day for de-duplication; further visitors that day are not counted. */
  viewRowsPerDay: 20_000,
} as const
