// Dev-only: serves the writing tool's file-writing API (app/api/write/**/route.dev.ts) from the Vite dev server.
// `apply: 'serve'` means it is not part of any build, so production output can never contain it. Each handler keeps its own
// guard() (development only, loopback only, same-origin only) as a second lock.
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

const ROUTES: { re: RegExp; file: string; params: string[] }[] = [
  { re: /^\/api\/write\/posts\/([^/]+)\/rename$/, file: '/app/api/write/posts/[slug]/rename/route.dev.ts', params: ['slug'] },
  { re: /^\/api\/write\/posts\/([^/]+)$/, file: '/app/api/write/posts/[slug]/route.dev.ts', params: ['slug'] },
  { re: /^\/api\/write\/posts$/, file: '/app/api/write/posts/route.dev.ts', params: [] },
  { re: /^\/api\/write\/upload$/, file: '/app/api/write/upload/route.dev.ts', params: [] },
]

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
  const method = req.method ?? 'GET'
  return new Request(`http://${req.headers.host}${req.url}`, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : body })
}

export function devWriteApi(): Plugin {
  return {
    name: 'michal:dev-write-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        const hit = ROUTES.map((r) => ({ r, m: r.re.exec(pathname) })).find((x) => x.m)
        if (!hit?.m) return next()
        try {
          const mod = await server.ssrLoadModule(hit.r.file)
          const handler = mod[req.method ?? 'GET']
          if (typeof handler !== 'function') {
            res.statusCode = 405
            return void res.end()
          }
          const params = Object.fromEntries(hit.r.params.map((p, i) => [p, decodeURIComponent(hit.m![i + 1])]))
          const out: Response = await handler(await toRequest(req), { params: Promise.resolve(params) })
          res.statusCode = out.status
          out.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await out.arrayBuffer()))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}
