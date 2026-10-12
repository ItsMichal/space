// Demo-only presence source for the /presence route when no Worker is running: fixed, made-up visitors at real city centres
// (snapped and jittered exactly like production). Never imported by the page template.
import { savedEmoji, saveEmoji, type PresenceClient, type PresenceState } from './client'
import { publicPoint } from './geo'
import type { LivePin, PastPin } from './protocol'

const CITIES: [string, string, number, number][] = [
  ['Denver', 'US', 39.74, -104.99],
  ['Warsaw', 'PL', 52.23, 21.01],
  ['Tokyo', 'JP', 35.68, 139.69],
  ['Lagos', 'NG', 6.52, 3.38],
  ['Sao Paulo', 'BR', -23.55, -46.63],
  ['Sydney', 'AU', -33.87, 151.21],
  ['Reykjavik', 'IS', 64.15, -21.94],
  ['Mumbai', 'IN', 19.08, 72.88],
  ['Toronto', 'CA', 43.65, -79.38],
  ['Berlin', 'DE', 52.52, 13.4],
  ['Cape Town', 'ZA', -33.92, 18.42],
  ['Seoul', 'KR', 37.57, 126.98],
  ['Mexico City', 'MX', 19.43, -99.13],
  ['London', 'GB', 51.51, -0.13],
  ['Singapore', 'SG', 1.35, 103.82],
  ['Seattle', 'US', 47.61, -122.33],
  ['Cairo', 'EG', 30.04, 31.24],
  ['Lima', 'PE', -12.05, -77.04],
]
const EMOJI = ['sprout', 'leaf', 'tea', 'moon', 'sun', 'butterfly', 'autumn', 'book']

export function createMockPresence(here: { city: string; country: string; lat: number; lon: number } = { city: 'Denver', country: 'US', lat: 39.74, lon: -104.99 }): PresenceClient {
  const subs = new Set<() => void>()
  const pt = (lat: number, lon: number, k: string) => publicPoint(lat, lon, k)!
  const youP = pt(here.lat, here.lon, 'you')
  let you: LivePin = { id: 'you', ...youP, city: here.city, country: here.country, emoji: savedEmoji() }
  const live: LivePin[] = CITIES.slice(1, 6).map(([city, country, lat, lon], i) => ({ id: 'm' + i, ...pt(lat, lon, 'm' + i), city, country, emoji: EMOJI[(i * 3) % 8] }))
  const past: PastPin[] = []
  for (let i = 0; i < 46; i++) {
    const [city, country, lat, lon] = CITIES[(i * 5) % CITIES.length]
    past.push({ ...pt(lat, lon, 'p' + i), city, country, emoji: EMOJI[(i * 7) % 8], day: '2026-10-10' })
  }
  let state: PresenceState = { status: 'idle', you: null, where: { city: here.city, region: '', country: here.country }, live: [], past: [], n: 0 }
  const emit = (p: Partial<PresenceState>) => {
    state = { ...state, ...p }
    subs.forEach((f) => f())
  }
  const publish = () => emit({ status: 'live', you, live, past, n: live.length + 1 })
  return {
    start: () => queueMicrotask(publish),
    pause() {},
    setEmoji(id) {
      saveEmoji(id)
      you = { ...you, emoji: id }
      publish()
    },
    destroy: () => subs.clear(),
    getState: () => state,
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}
