import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

// Posts with a `parent` live at /projects/<parent>/<slug>. Their pre-nesting URLs (/writing/<slug> for articles,
// /projects/<slug> for projects) permanently redirect there, so nothing indexed breaks. Derived from the frontmatter,
// so setting a parent on any existing post redirects its old URL automatically.
function nestedRedirects() {
  const dir = path.join(process.cwd(), 'content', 'posts')
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (!data.parent || data.draft) continue
    const slug = String(data.slug ?? f.replace(/\.md$/, ''))
    const oldBase = data.kind === 'article' ? '/writing' : '/projects'
    for (const suffix of ['', '/opengraph-image']) {
      out.push({ source: `${oldBase}/${slug}${suffix}`, destination: `/projects/${data.parent}/${slug}${suffix}`, permanent: true })
    }
  }
  return out
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The writing tool lives in files named page.dev.tsx / route.dev.ts / layout.dev.tsx. Those extensions are only
  // registered under `next dev`, so `next build` (and therefore the Cloudflare worker) never sees /write or /api/write.
  pageExtensions:
    process.env.NODE_ENV === 'development'
      ? ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts']
      : ['tsx', 'ts', 'jsx', 'js'],
  async redirects() {
    return [
      ...nestedRedirects(),
      // legacy slug from the old content/projects.ts list
      { source: '/projects/barcode-game', destination: '/projects/office-wizards-barcode-game', permanent: true },
    ]
  },
}

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

export default nextConfig
