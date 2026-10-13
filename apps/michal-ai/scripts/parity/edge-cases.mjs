// Edge-case table: the same request against two servers (golden Next, candidate Worker), key response facts side by side.
//   node scripts/parity/edge-cases.mjs <golden-base> <candidate-base>
const [gBase, cBase] = process.argv.slice(2)
const pick = (r, body) => {
  const h = (k) => r.headers.get(k)
  const bits = [r.status]
  if (h('location')) bits.push(`-> ${h('location').replace(/^https?:\/\/[^/]+/, '')}`)
  if (h('content-type')) bits.push(h('content-type').replace(/;\s*charset=utf-8/i, ';utf8'))
  if (h('content-range')) bits.push(`range ${h('content-range')}`)
  if (h('accept-ranges')) bits.push(`ar:${h('accept-ranges')}`)
  if (h('content-encoding')) bits.push(`enc:${h('content-encoding')}`)
  if (h('etag')) bits.push('etag')
  if (h('x-robots-tag')) bits.push(`xrt:${h('x-robots-tag')}`)
  if (body !== undefined) bits.push(`${body}b`)
  return bits.join(' ')
}
const cases = [
  ['HEAD /about', '/about', { method: 'HEAD' }],
  ['HEAD /michal.png', '/michal.png', { method: 'HEAD' }],
  ['GET /resume.pdf Range 0-99', '/resume.pdf', { headers: { Range: 'bytes=0-99' } }],
  ['GET /globe/starlink-live.bin Range 0-99', '/globe/starlink-live.bin', { headers: { Range: 'bytes=0-99' } }],
  ['GET /about Accept-Encoding gzip,br', '/about', { headers: { 'Accept-Encoding': 'gzip, br' }, raw: true }],
  ['GET /feed.xml', '/feed.xml', {}],
  ['GET /feed.json', '/feed.json', {}],
  ['GET /sitemap.xml', '/sitemap.xml', {}],
  ['GET /robots.txt', '/robots.txt', {}],
  ['GET /about with If-None-Match (etag from first GET)', '/about', { conditional: true }],
  ['GET /about, Host: space.example.workers.dev', '/about', { headers: { Host: 'space.example.workers.dev' }, noHost: true }],
  ['GET /?ref=x', '/?ref=x', {}],
  ['GET /?portrait=glyphs', '/?portrait=glyphs', {}],
  ['GET /about?x=1', '/about?x=1', {}],
  ['GET /About (uppercase)', '/About', {}],
  ['GET /ABOUT/', '/ABOUT/', {}],
  ['GET /writing/Kinetic-Typography', '/writing/Kinetic-Typography', {}],
  ['GET /%61bout (percent-encoded)', '/%61bout', {}],
  ['GET /writing/kinetic%2Dtypography', '/writing/kinetic%2Dtypography', {}],
  ['GET /index.html', '/index.html', {}],
  ['GET /about/index.html', '/about/index.html', {}],
  ['GET /projects/x/y/z (nested unknown)', '/projects/x/y/z', {}],
  ['GET /projects/starlink/order-flow/extra', '/projects/starlink/order-flow/extra', {}],
  ['GET old slug /projects/frogchamp-ai-chat-stream', '/projects/frogchamp-ai-chat-stream', {}],
  ['GET old slug .data (direct hit)', '/projects/frogchamp-ai-chat-stream.data', {}],
  ['GET /writing/does-not-exist.data', '/writing/does-not-exist.data', {}],
  ['GET //about (double slash)', '//about', {}],
]
const run = async (base, p, c) => {
  try {
    const hdr = { ...(c.headers ?? {}) }
    if (c.noHost) delete hdr.Host
    let init = { method: c.method ?? 'GET', redirect: 'manual', headers: hdr }
    if (c.noHost) init.headers = {}
    if (c.conditional) {
      const first = await fetch(base + p, { redirect: 'manual' })
      const tag = first.headers.get('etag')
      if (!tag) return 'no etag on first response'
      init.headers = { 'If-None-Match': tag }
    }
    const r = await fetch(base + p, init)
    const isText = /text|json|xml/.test(r.headers.get('content-type') ?? '')
    const body = c.method === 'HEAD' ? 0 : isText ? Buffer.byteLength(await r.text()) : (await r.arrayBuffer()).byteLength
    return pick(r, body)
  } catch (e) {
    return `error ${String(e).slice(0, 60)}`
  }
}
console.log('| case | golden (Next) | candidate (Worker) |\n| --- | --- | --- |')
for (const [name, p, c] of cases) console.log(`| ${name} | ${await run(gBase, p, c)} | ${await run(cBase, p, c)} |`)
