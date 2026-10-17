'use client'
// Route bodies of the writing tool, shared by the local dev routes (app/dev/write.tsx) and the hosted editor (write/main.tsx).
// Each side brings its own loaders; these only render what they load.
import type { ReactNode } from 'react'
import type { Root } from 'hast'
import type { PostFrontmatter } from '@/lib/content/types'
import type { PostSummary } from '@/lib/editor/wire'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { hastToReact } from '@/lib/content/to-react'
import { Link } from '@/lib/nav'

export function WriteShell({ children }: { children: ReactNode }) {
  return (
    <div className="ed-root" style={{ ['--ed-serif' as string]: 'var(--font-newsreader)', ['--ed-sans' as string]: 'ui-sans-serif, system-ui, sans-serif', ['--ed-mono' as string]: 'var(--font-plex-mono)' }}>
      <ReadingTheme />
      {children}
    </div>
  )
}

/** What the editor needs to know about the other posts (slug clashes, parent projects, tag suggestions). */
export function editContext(all: PostSummary[], slug: string) {
  return {
    allTags: [...new Set(all.flatMap((p) => p.tags))].sort(),
    otherSlugs: all.filter((p) => p.id !== slug).flatMap((p) => [p.id, p.slug]),
    projects: all.filter((p) => p.kind === 'project' && p.id !== slug).map((p) => ({ slug: p.slug, title: p.title })),
  }
}

export const readingMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220))

export function WritePreview({ slug, frontmatter: fm, minutes, hast, note }: { slug: string; frontmatter: PostFrontmatter; minutes: number; hast: unknown; note: string }) {
  return (
    <div className="ed-preview">
      <div className="ed-preview__bar">
        <Link href={`/write/${slug}`} className="ed-btn-text">
          Back to editor
        </Link>
        <span className="ed-meta">
          {fm.draft ? 'Draft preview' : 'Published'} · {note}
        </span>
      </div>
      <article className="ed-page">
        <p className="ed-eyebrow">
          {fm.kind === 'article' ? 'Writing' : 'Project'} · {minutes} min read
        </p>
        <h1 className="ed-title ed-title--static">{fm.title}</h1>
        <div className="prose ed-prose">{hastToReact(hast as Root)}</div>
      </article>
    </div>
  )
}
