// Wire types for /api/live/*. DOM-free; imported by the Worker and the browser client.

/** A visitor on the globe. `id` is a random per-connection public id, unrelated to the client's session id. */
export interface LivePin {
  id: string
  lat: number
  lon: number
  city: string
  country: string
  emoji: string
}

/** A recent visitor who is not online now. */
export interface PastPin {
  lat: number
  lon: number
  city: string
  country: string
  emoji: string
  day: string
}

export interface Welcome {
  t: 'welcome'
  /** This visitor, as everyone else sees them (null when the edge gave no location). */
  you: LivePin | null
  /** City / region / country for the greeting. */
  where: { city: string; region: string; country: string }
  live: LivePin[]
  past: PastPin[]
}

export type ServerMsg =
  | Welcome
  | { t: 'd'; add?: LivePin[]; rm?: string[]; em?: [string, string][]; n: number }
  | { t: 'full' }

export interface ReactionTotals {
  v: 1
  /** Stable post id. */
  id: string
  /** Visits counted for this post. Present only while the Worker var VIEWS_PUBLIC is not "0". */
  views?: number
  post: Record<string, number>
  blocks: Record<string, Record<string, number>>
}

export interface ReactionResult {
  v: 1
  target: string
  counts: Record<string, number>
  mine: string[]
}
