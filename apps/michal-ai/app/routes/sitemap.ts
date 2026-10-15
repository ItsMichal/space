import sitemap from '../sitemap'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Same XML Next serialised from app/sitemap.ts.
export function loader() {
  const urls = sitemap()
    .map((e) => {
      const parts = [`<loc>${esc(e.url)}</loc>`]
      if (e.lastModified) parts.push(`<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>`)
      if (e.changeFrequency) parts.push(`<changefreq>${e.changeFrequency}</changefreq>`)
      if (e.priority !== undefined) parts.push(`<priority>${e.priority}</priority>`)
      return `<url>\n${parts.join('\n')}\n</url>\n`
    })
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
