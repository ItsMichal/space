// Zero-dependency static server for local dev. PORT=4310 by default. Serves ./public like the deployed assets layer
// (404.html for unknown paths) and answers /api/live and /api/clips with an "unknown" payload, since the real one lives in worker/index.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/clips') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end('{"clips":[],"unknown":true}'); }
  if (p === '/api/live') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end('{"live":false,"unknown":true}'); }
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(root, path.normalize(p)), status = 200;
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { file = path.join(root, '404.html'); status = 404; }
  res.writeHead(status, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
const port = +(process.env.PORT ?? 4310);
server.listen(port, () => console.log(`halmic: http://localhost:${port}/  (?live=1 forces the live state, ?live=0 the offline one)`));
