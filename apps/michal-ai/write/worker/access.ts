// Cloudflare Access check, behind the Access application itself (defense in depth). Every request must carry a
// Cf-Access-Jwt-Assertion signed by the team's current keys, for this application's AUD, from the team's issuer, and unexpired.
// Missing configuration fails closed. https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
import { b64urlDecode, utf8 } from './http'

export type AccessConfig = {
  /** "<team>" or "<team>.cloudflareaccess.com" */
  teamDomain: string
  /** The Access application's Application Audience (AUD) tag. */
  aud: string
  /** Optional extra allowlist of identities (lowercase emails). */
  emails?: string[]
}

export type AccessClaims = { aud: string | string[]; iss: string; exp: number; nbf?: number; iat?: number; email?: string; sub?: string }

export class AccessDenied extends Error {}

type Jwk = JsonWebKey & { kid?: string }
const JWKS_TTL_MS = 10 * 60_000
const SKEW_S = 30
const jwks = new Map<string, { keys: Jwk[]; at: number }>()

export function clearJwksCache() {
  jwks.clear()
}

export function issuerFor(teamDomain: string): string {
  const host = teamDomain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  return `https://${host.includes('.') ? host : `${host}.cloudflareaccess.com`}`
}

async function keysFor(iss: string, fresh: boolean): Promise<Jwk[]> {
  const hit = jwks.get(iss)
  if (hit && !fresh && Date.now() - hit.at < JWKS_TTL_MS) return hit.keys
  const res = await fetch(`${iss}/cdn-cgi/access/certs`)
  if (!res.ok) throw new AccessDenied(`could not fetch signing keys (${res.status})`)
  const { keys } = (await res.json()) as { keys?: Jwk[] }
  if (!Array.isArray(keys)) throw new AccessDenied('signing keys response has no keys')
  jwks.set(iss, { keys, at: Date.now() })
  return keys
}

function decodePart<T>(part: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(part))) as T
  } catch {
    throw new AccessDenied('malformed token')
  }
}

export async function verifyAccessJwt(token: string | null | undefined, cfg: AccessConfig, nowMs = Date.now()): Promise<AccessClaims> {
  if (!cfg.teamDomain?.trim() || !cfg.aud?.trim()) throw new AccessDenied('Access is not configured (ACCESS_TEAM_DOMAIN, ACCESS_AUD)')
  if (!token) throw new AccessDenied('missing Cf-Access-Jwt-Assertion')
  const parts = token.split('.')
  if (parts.length !== 3) throw new AccessDenied('malformed token')
  const header = decodePart<{ alg?: string; kid?: string }>(parts[0])
  const claims = decodePart<AccessClaims>(parts[1])
  if (header.alg !== 'RS256') throw new AccessDenied('unexpected algorithm')

  const iss = issuerFor(cfg.teamDomain)
  let jwk = (await keysFor(iss, false)).find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await keysFor(iss, true)).find((k) => k.kid === header.kid) // keys rotate
  if (!jwk) throw new AccessDenied('unknown signing key')

  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(parts[2]), utf8(`${parts[0]}.${parts[1]}`))
  if (!ok) throw new AccessDenied('bad signature')

  const now = Math.floor(nowMs / 1000)
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!auds.includes(cfg.aud.trim())) throw new AccessDenied('wrong audience')
  if (claims.iss !== iss) throw new AccessDenied('wrong issuer')
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new AccessDenied('expired')
  if (typeof claims.nbf === 'number' && claims.nbf > now + SKEW_S) throw new AccessDenied('not yet valid')
  if (cfg.emails?.length && !cfg.emails.includes((claims.email ?? '').toLowerCase())) throw new AccessDenied('identity not allowed')
  return claims
}
