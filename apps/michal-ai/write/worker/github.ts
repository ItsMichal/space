// GitHub credentials and a thin REST/GraphQL client. Credentials come only from Worker secrets (docs/write.md):
// a GitHub App (GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + GITHUB_APP_INSTALLATION_ID) is preferred; GITHUB_TOKEN (a fine-grained
// PAT) is the fallback. Nothing here logs or returns a token.
import { HttpError, b64decode, b64url, utf8 } from './http'

export type GitHubSecrets = {
  GITHUB_TOKEN?: string
  GITHUB_APP_ID?: string
  GITHUB_APP_PRIVATE_KEY?: string
  GITHUB_APP_INSTALLATION_ID?: string
}

const API = 'https://api.github.com'
const UA = 'write.michal.ai'

/* ------------------------------------------------------------- credentials */

function der(tag: number, body: Uint8Array): Uint8Array {
  const n = body.length
  const len = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : n < 0x10000 ? [0x82, n >> 8, n & 0xff] : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff]
  const out = new Uint8Array(1 + len.length + n)
  out[0] = tag
  out.set(len, 1)
  out.set(body, 1 + len.length)
  return out
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** PEM private key to PKCS#8 DER. GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY"), which WebCrypto cannot import, so wrap it. */
export function pemToPkcs8(pem: string): Uint8Array {
  const text = pem.replace(/\\n/g, '\n').trim()
  const m = /-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]+?)-----END (RSA )?PRIVATE KEY-----/.exec(text)
  if (!m) throw new HttpError(500, 'GITHUB_APP_PRIVATE_KEY is not a PEM private key')
  const body = b64decode(m[2])
  if (!m[1]) return body
  const version = new Uint8Array([0x02, 0x01, 0x00])
  const rsaAlg = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00])
  return der(0x30, concat(version, rsaAlg, der(0x04, body)))
}

export async function appJwt(appId: string, pem: string, nowMs = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const now = Math.floor(nowMs / 1000)
  const head = b64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const body = b64url(utf8(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })))
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

let cached: { id: string; token: string; expires: number } | null = null
export function clearTokenCache() {
  cached = null
}

export async function githubToken(env: GitHubSecrets, nowMs = Date.now()): Promise<string> {
  const { GITHUB_APP_ID: appId, GITHUB_APP_PRIVATE_KEY: pem, GITHUB_APP_INSTALLATION_ID: inst } = env
  if (appId && pem && inst) {
    const id = `${appId}/${inst}`
    if (cached?.id === id && cached.expires - 5 * 60_000 > nowMs) return cached.token
    const res = await fetch(`${API}/app/installations/${encodeURIComponent(inst)}/access_tokens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await appJwt(appId, pem, nowMs)}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': UA },
    })
    if (!res.ok) throw new HttpError(502, `GitHub App token request failed (${res.status})`)
    const { token, expires_at } = (await res.json()) as { token: string; expires_at: string }
    cached = { id, token, expires: Date.parse(expires_at) }
    return token
  }
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN
  throw new HttpError(500, 'No GitHub credential: set the GitHub App secrets or GITHUB_TOKEN (docs/write.md)')
}

/* ------------------------------------------------------------------ client */

export class GitHub {
  constructor(
    private token: string,
    readonly owner: string,
    readonly repo: string
  ) {}

  private headers(accept = 'application/vnd.github+json'): Record<string, string> {
    return { authorization: `Bearer ${this.token}`, accept, 'x-github-api-version': '2022-11-28', 'user-agent': UA }
  }

  /** Raw response for a repo path (e.g. `contents/...`), or null on 404. */
  async raw(path: string): Promise<Response | null> {
    const res = await fetch(`${API}/repos/${this.owner}/${this.repo}/${path}`, { headers: this.headers('application/vnd.github.raw+json') })
    if (res.status === 404) return null
    if (!res.ok) throw new HttpError(502, `GitHub GET ${path}: ${res.status}`)
    return res
  }

  /** REST call relative to /repos/<owner>/<repo>/. A 404 resolves to null when `allow404` is set. */
  async rest<T>(method: string, path: string, body?: unknown, opts: { allow404?: boolean } = {}): Promise<T> {
    const res = await fetch(`${API}/repos/${this.owner}/${this.repo}/${path}`, {
      method,
      headers: { ...this.headers(), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 404 && opts.allow404) return null as T
    if (res.status === 204) return null as T
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) {
      const status = res.status === 409 || res.status === 422 ? 409 : 502
      throw new HttpError(status, `GitHub ${method} ${path.split('?')[0]}: ${res.status} ${data.message ?? ''}`.trim())
    }
    return data as T
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { owner: this.owner, name: this.repo, ...variables } }),
    })
    const out = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] }
    if (!res.ok || !out.data) throw new HttpError(502, `GitHub GraphQL: ${res.status} ${out.errors?.[0]?.message ?? ''}`.trim())
    return out.data
  }
}
