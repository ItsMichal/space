// Node-only helpers (build scripts and tests): read the michal.ai posts' routing frontmatter without a YAML dependency.
import fs from 'node:fs'
import path from 'node:path'

const scalar = (fm, k) => {
  const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
}

/** Live (non-draft) michal.ai posts as { id, slug, kind, parent, title } straight from the frontmatter. */
export function readMichalPosts(repoRoot) {
  const dir = path.join(repoRoot, 'apps', 'michal-ai', 'content', 'posts')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) => {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
      if (scalar(fm, 'draft') === 'true') return []
      const slug = scalar(fm, 'slug') ?? f.replace(/\.md$/, '')
      return [
        {
          id: scalar(fm, 'id') ?? slug,
          slug,
          title: scalar(fm, 'title'),
          kind: scalar(fm, 'kind') === 'article' ? 'article' : 'project',
          parent: scalar(fm, 'parent'),
        },
      ]
    })
}
