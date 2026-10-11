// Every editor API route calls guard() first. The routes only exist in `next dev` (see next.config.mjs
// pageExtensions), and this is the second lock: development only, loopback only, same-origin only.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

const hostnameOf = (hostHeader: string) => hostHeader.replace(/:\d+$/, '').toLowerCase()

export function guard(req: Request): Response | null {
  if (process.env.NODE_ENV !== 'development') return json({ error: 'Not found' }, 404)

  // Host defeats DNS rebinding (a public name pointing at 127.0.0.1 has the wrong Host).
  if (!LOCAL_HOSTS.has(hostnameOf(req.headers.get('host') ?? ''))) return json({ error: 'Local requests only' }, 403)

  // Origin / Sec-Fetch-Site defeat cross-site requests from other tabs.
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      if (!LOCAL_HOSTS.has(new URL(origin).hostname)) return json({ error: 'Cross-origin request refused' }, 403)
    } catch {
      return json({ error: 'Bad origin' }, 403)
    }
  }
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'Cross-site request refused' }, 403)

  return null
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
