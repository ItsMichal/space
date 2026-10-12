// Dev helper: one origin for `next dev` (default :3000) and `wrangler dev` (default :8787), so the /presence lab can talk
// to the real Worker (HTTP and WebSocket) while pages come from Next. Usage: node scripts/dev-live-proxy.mjs  -> http://localhost:3100
import http from 'node:http'
import net from 'node:net'

const PORT = Number(process.env.PORT ?? 3100)
const NEXT = Number(process.env.NEXT_PORT ?? 3000)
const WORKER = Number(process.env.WORKER_PORT ?? 8787)
const isLive = (url = '') => url.startsWith('/api/live')
const target = (url) => (isLive(url) ? WORKER : NEXT)

const server = http.createServer((req, res) => {
  const p = http.request({ host: '127.0.0.1', port: target(req.url), path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  p.on('error', () => {
    res.writeHead(502)
    res.end()
  })
  req.pipe(p)
})
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(target(req.url), '127.0.0.1', () => {
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n')
    if (head?.length) up.write(head)
    up.pipe(socket)
    socket.pipe(up)
  })
  up.on('error', () => socket.destroy())
  socket.on('error', () => up.destroy())
})
server.listen(PORT, () => console.log(`proxy http://localhost:${PORT} -> next :${NEXT}, /api/live -> worker :${WORKER}`))
