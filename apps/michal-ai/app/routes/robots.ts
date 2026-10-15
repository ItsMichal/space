import robots from '../robots'

export function loader() {
  const r = robots()
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
  const blocks = rules.map((rule) => {
    const lines = [`User-Agent: ${rule.userAgent}`]
    for (const a of [rule.allow ?? []].flat()) lines.push(`Allow: ${a}`)
    for (const d of [rule.disallow ?? []].flat()) lines.push(`Disallow: ${d}`)
    return lines.join('\n')
  })
  const txt = `${blocks.join('\n\n')}\n\nSitemap: ${r.sitemap}\n`
  return new Response(txt, { headers: { 'Content-Type': 'text/plain' } })
}
