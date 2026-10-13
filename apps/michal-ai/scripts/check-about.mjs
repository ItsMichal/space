// Checks /about and /resume: every internal link resolves to a route, no city names, no em or en dashes, JSON-LD parses and has the
// required Person and ProfilePage fields.
//   node scripts/check-about.mjs [http://localhost:3100]   against a running site (HTTP 200 for every internal link)
//   node scripts/check-about.mjs --built                   against the prerendered build in .next/server/app (no server needed)
import fs from 'node:fs'
import path from 'node:path'

const arg = process.argv[2] ?? 'http://localhost:3100'
const built = arg === '--built'
const appDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.next', 'server', 'app')
const publicDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public')
const CITIES = new RegExp(['Haw', 'thorne'].join('') + '|Los Angeles|Highlands Ranch|Denver(?! Post)|El Segundo|Torrance|Culver City|Venice|Santa Monica|Long Beach', 'i')
let failed = 0
const fail = (m) => {
  failed++
  console.error('FAIL', m)
}
const get = async (route) => {
  if (built) return { status: fs.existsSync(path.join(appDir, route === '/' ? 'index.html' : `${route}.html`)) ? 200 : 404, text: async () => fs.readFileSync(path.join(appDir, `${route}.html`), 'utf8') }
  return fetch(arg + route, { redirect: 'manual' })
}
const exists = async (l) => {
  if (built && ['/manifest.webmanifest', '/favicon.ico'].includes(l)) return true // metadata routes, not .html files
  if (!built) return (await get(l)).status === 200
  if (l === '/' || fs.existsSync(path.join(appDir, `${l}.html`)) || fs.existsSync(path.join(publicDir, l))) return true
  // dynamic segments are prerendered as <slug>.html or <parent>/<child>.html
  return fs.existsSync(path.join(appDir, l, 'index.html'))
}
for (const route of ['/about', '/resume']) {
  const res = await get(route)
  if (res.status !== 200) {
    fail(`${route} status ${res.status}`)
    continue
  }
  const html = await res.text()
  // visible text only (tags and attribute values such as the Denver Post URL are not copy)
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
  const hit = text.match(CITIES)
  if (hit) fail(`${route} mentions a city: ${hit[0]}`)
  // The CHI citation's page range (1 to 17) is printed with the publisher's en dash (allowlisted in scripts/dash-allowlist.txt).
  const noRanges = html.replace(/\d–\d/g, '')
  if (/[–—]|&mdash;|&ndash;/.test(noRanges)) fail(`${route} contains a dash character`)
  const links = new Set([...html.matchAll(/href="(\/[^"#?]*)(?:[#?][^"]*)?"/g)].map((m) => m[1]).filter((h) => !h.startsWith('/_next') && !h.startsWith('//')))
  for (const l of links) if (!(await exists(l))) fail(`${route} links to ${l}: not found`)
  console.log(route, 'internal links checked:', links.size, [...links].join(' '))
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, '<')))
  if (route === '/about') {
    const page = ld.find((d) => d['@type'] === 'ProfilePage')
    if (!page) fail('/about has no ProfilePage')
    else {
      for (const k of ['@id', 'url', 'name', 'mainEntity']) if (!page[k]) fail(`ProfilePage missing ${k}`)
      const p = page.mainEntity
      if (p['@type'] !== 'Person' || p['@id'] !== 'https://michal.ai/#person') fail('mainEntity is not the site Person node')
      for (const k of ['name', 'url', 'jobTitle', 'sameAs', 'worksFor', 'alumniOf']) if (!p[k]) fail(`Person missing ${k}`)
      for (const s of ['https://x.com/ItsMichal', 'https://github.com/ItsMichal', 'https://www.linkedin.com/in/mbodzianowski/']) if (!p.sameAs.includes(s)) fail(`sameAs missing ${s}`)
      if (JSON.stringify(p).match(CITIES)) fail('Person JSON-LD names a city')
    }
  }
  console.log(route, 'JSON-LD blocks:', ld.map((d) => d['@type']).join(', '))
}
process.exit(failed ? 1 : 0)
