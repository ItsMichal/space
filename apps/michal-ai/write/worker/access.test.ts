import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessDenied, clearJwksCache, issuerFor, verifyAccessJwt } from './access'
import { b64url, utf8 } from './http'

const TEAM = 'example-team'
const ISS = 'https://example-team.cloudflareaccess.com'
const AUD = 'aud-tag-123'
const NOW = 1_800_000_000_000
const cfg = { teamDomain: TEAM, aud: AUD }

const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
let good: CryptoKeyPair
let other: CryptoKeyPair
let jwks: JsonWebKey[]
let fetches: string[]

async function sign(claims: Record<string, unknown>, opts: { kid?: string; key?: CryptoKey; alg?: string } = {}) {
  const head = b64url(utf8(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' })))
  const body = b64url(utf8(JSON.stringify(claims)))
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? good.privateKey, utf8(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

const claims = (over: Record<string, unknown> = {}) => ({ aud: [AUD], iss: ISS, exp: NOW / 1000 + 600, iat: NOW / 1000, email: 'owner@example.com', ...over })

beforeAll(async () => {
  good = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair
  other = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair
})

beforeEach(async () => {
  clearJwksCache()
  fetches = []
  jwks = [{ ...(await crypto.subtle.exportKey('jwk', good.publicKey)), kid: 'k1' } as JsonWebKey]
  vi.stubGlobal('fetch', async (url: string) => {
    fetches.push(String(url))
    if (String(url) !== `${ISS}/cdn-cgi/access/certs`) return new Response('no', { status: 404 })
    return Response.json({ keys: jwks })
  })
})

afterEach(() => vi.unstubAllGlobals())

const denied = (p: Promise<unknown>, msg: RegExp) => expect(p).rejects.toSatisfy((e: unknown) => e instanceof AccessDenied && msg.test((e as Error).message))

describe('verifyAccessJwt', () => {
  it('accepts a valid token and reads keys from the team certs endpoint', async () => {
    const out = await verifyAccessJwt(await sign(claims()), cfg, NOW)
    expect(out.email).toBe('owner@example.com')
    expect(fetches).toEqual([`${ISS}/cdn-cgi/access/certs`])
  })

  it('accepts a string aud and a full team host', async () => {
    await expect(verifyAccessJwt(await sign(claims({ aud: AUD })), { ...cfg, teamDomain: 'example-team.cloudflareaccess.com' }, NOW)).resolves.toBeTruthy()
    expect(issuerFor('https://example-team.cloudflareaccess.com/')).toBe(ISS)
  })

  it('rejects a missing token', async () => {
    await denied(verifyAccessJwt(null, cfg, NOW), /missing/)
    await denied(verifyAccessJwt('', cfg, NOW), /missing/)
  })

  it('rejects the wrong audience', async () => {
    await denied(verifyAccessJwt(await sign(claims({ aud: ['someone-else'] })), cfg, NOW), /audience/)
  })

  it('rejects an expired token', async () => {
    await denied(verifyAccessJwt(await sign(claims({ exp: NOW / 1000 - 1 })), cfg, NOW), /expired/)
    await denied(verifyAccessJwt(await sign(claims({ exp: NOW / 1000 })), cfg, NOW), /expired/)
    await denied(verifyAccessJwt(await sign(claims({ exp: undefined })), cfg, NOW), /expired/)
  })

  it('rejects a token that is not valid yet', async () => {
    await denied(verifyAccessJwt(await sign(claims({ nbf: NOW / 1000 + 120 })), cfg, NOW), /not yet/)
  })

  it('rejects the wrong issuer', async () => {
    await denied(verifyAccessJwt(await sign(claims({ iss: 'https://evil.cloudflareaccess.com' })), cfg, NOW), /issuer/)
  })

  it('rejects a bad signature, an unknown key and other algorithms', async () => {
    await denied(verifyAccessJwt(await sign(claims(), { key: other.privateKey }), cfg, NOW), /signature/)
    await denied(verifyAccessJwt(await sign(claims(), { kid: 'nope' }), cfg, NOW), /unknown signing key/)
    await denied(verifyAccessJwt(await sign(claims(), { alg: 'none' }), cfg, NOW), /algorithm/)
    const [h, b] = (await sign(claims())).split('.')
    await denied(verifyAccessJwt(`${h}.${b}.`, cfg, NOW), /signature/)
    await denied(verifyAccessJwt('not.a.jwt', cfg, NOW), /malformed/)
  })

  it('refetches the keys once when the kid is new (rotation)', async () => {
    await verifyAccessJwt(await sign(claims()), cfg, NOW)
    jwks = [{ ...(await crypto.subtle.exportKey('jwk', other.publicKey)), kid: 'k2' } as JsonWebKey]
    await expect(verifyAccessJwt(await sign(claims(), { kid: 'k2', key: other.privateKey }), cfg, NOW)).resolves.toBeTruthy()
    expect(fetches).toHaveLength(2)
  })

  it('fails closed without configuration', async () => {
    const token = await sign(claims())
    await denied(verifyAccessJwt(token, { teamDomain: '', aud: AUD }, NOW), /not configured/)
    await denied(verifyAccessJwt(token, { teamDomain: TEAM, aud: '' }, NOW), /not configured/)
    expect(fetches).toEqual([])
  })

  it('applies the optional email allowlist', async () => {
    await denied(verifyAccessJwt(await sign(claims({ email: 'intruder@example.com' })), { ...cfg, emails: ['owner@example.com'] }, NOW), /not allowed/)
    await expect(verifyAccessJwt(await sign(claims({ email: 'Owner@Example.com' })), { ...cfg, emails: ['owner@example.com'] }, NOW)).resolves.toBeTruthy()
  })

  it('denies when the keys cannot be fetched', async () => {
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }))
    await denied(verifyAccessJwt(await sign(claims()), cfg, NOW), /signing keys/)
  })
})
