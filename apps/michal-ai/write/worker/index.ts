// Worker `write` (write.michal.ai): the writing tool, hosted. Serves the editor SPA (write/dist) and /api/write/*, the same API the
// local dev editor uses, backed by GitHub instead of the working tree (repo.ts). Everything is behind Cloudflare Access, and every
// request is checked again here (access.ts); a request that fails the check gets a 403 and nothing else. See docs/write.md.
import { AccessDenied, verifyAccessJwt } from './access'
import { GitHub, githubToken, type GitHubSecrets } from './github'
import { HttpError, json } from './http'
import { Repo } from './repo'

export interface Env extends GitHubSecrets {
  ASSETS: Fetcher
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  /** Optional comma-separated allowlist of emails, checked against the token's `email` claim. */
  ACCESS_EMAILS?: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
  GITHUB_BASE: string
  SITE_ORIGIN: string
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex, nofollow',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
}

function withHeaders(res: Response, extra: Record<string, string> = {}): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v)
  return out
}

export async function authorize(req: Request, env: Env): Promise<Response | null> {
  try {
    const emails = (env.ACCESS_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    await verifyAccessJwt(req.headers.get('cf-access-jwt-assertion'), { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD, emails })
    return null
  } catch (err) {
    if (!(err instanceof AccessDenied)) console.error('[write] access check failed', err)
    return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store', ...SECURITY_HEADERS } })
  }
}

/** Writes must come from this origin's own pages (the Access cookie alone would ride along on a cross-site form post). */
function sameOrigin(req: Request, url: URL): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true
  return req.headers.get('origin') === url.origin
}

async function repoFor(env: Env): Promise<Repo> {
  const gh = new GitHub(await githubToken(env), env.GITHUB_OWNER, env.GITHUB_REPO)
  return new Repo(gh, { base: env.GITHUB_BASE || 'main', root: 'apps/michal-ai', siteOrigin: env.SITE_ORIGIN })
}

export async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (!sameOrigin(req, url)) return json({ error: 'Cross-origin request refused' }, 403)
  const path = url.pathname.replace(/\/+$/, '')
  const m = /^\/api\/write\/posts\/([^/]+)(?:\/(rename|status|ship))?$/.exec(path)
  const slug = m ? decodeURIComponent(m[1]) : ''
  const sub = m?.[2]
  const route = `${req.method} ${path === '/api/write/posts' ? 'posts' : path === '/api/write/upload' ? 'upload' : m ? `post${sub ? `/${sub}` : ''}` : '?'}`
  try {
    const repo = await repoFor(env)
    switch (route) {
      case 'GET posts':
        return json(await repo.list())
      case 'POST posts': {
        const body = (await req.json().catch(() => ({}))) as { title?: string; kind?: 'project' | 'article' }
        return json(await repo.create(body))
      }
      case 'GET post':
        return json(await repo.read(slug))
      case 'PUT post': {
        const input = (await req.json().catch(() => null)) as Parameters<Repo['save']>[1] | null
        if (!input?.frontmatter || typeof input.body !== 'string') throw new HttpError(400, 'frontmatter and body are required')
        return json(await repo.save(slug, input))
      }
      case 'DELETE post':
        throw new HttpError(405, 'Deleting posts is not available in the hosted editor; remove the file in a pull request')
      case 'POST post/rename': {
        const input = (await req.json().catch(() => null)) as { newSlug?: string } | null
        if (!input?.newSlug) throw new HttpError(400, 'newSlug is required')
        return json(await repo.rename(slug, input.newSlug))
      }
      case 'GET post/status':
        return json(await repo.status(slug))
      case 'POST post/ship':
        return json(await repo.ship(slug))
      case 'POST upload': {
        const form = await req.formData().catch(() => null)
        const s = form?.get('slug')
        const file = form?.get('file')
        if (typeof s !== 'string' || !file || typeof file === 'string') throw new HttpError(400, 'slug and file are required')
        const n = (k: string) => Math.max(0, Number(form?.get(k)) || 0)
        return json(await repo.upload(s, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), width: n('width'), height: n('height'), converted: Boolean(form?.get('converted')) }))
      }
      default:
        return json({ error: 'Not found' }, 404)
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status)
    console.error('[write api]', err)
    return json({ error: 'Internal error' }, 500)
  }
}

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml' }

/** Site files the editor shows but does not ship: fonts and textures, and media (a branch's new images first, then the live site's). */
async function siteFile(req: Request, env: Env, url: URL): Promise<Response> {
  const media = /^\/media\/([a-z0-9-]+)\/([^/]+)$/.exec(url.pathname)
  if (media) {
    try {
      const hit = await (await repoFor(env)).branchFile(media[1], media[2])
      if (hit) {
        const ext = media[2].split('.').pop()!.toLowerCase()
        return new Response(hit.body, { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'private, max-age=60' } })
      }
    } catch (err) {
      console.error('[write] branch media', err)
    }
  }
  const res = await fetch(new URL(url.pathname, env.SITE_ORIGIN), { headers: { accept: req.headers.get('accept') ?? '*/*' } })
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' } })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const denied = await authorize(req, env)
    if (denied) return denied
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/write/')) return withHeaders(await api(req, env, url))
    if (req.method === 'GET' && /^\/(media|fonts|textures)\//.test(url.pathname)) return withHeaders(await siteFile(req, env, url))
    if (url.pathname === '/') return Response.redirect(new URL('/write', url).toString(), 302)
    return withHeaders(await env.ASSETS.fetch(req))
  },
} satisfies ExportedHandler<Env>
