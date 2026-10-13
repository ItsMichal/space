// Dev-only routes for the writing tool (/write, /write/:slug, /write/:slug/preview). Never part of a production build (see app/routes.ts).
// The loaders read and list posts from disk; the editor's save/upload API is the Vite dev middleware in vite/dev-api.mts.
import { Outlet, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import type { Root } from 'hast'
import { PostIndex } from '@/components/editor/PostIndex'
import { PostEditor } from '@/components/editor/PostEditor'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { hastToReact } from '@/lib/content/to-react'
import { Link } from '@/lib/nav'
import '../write/editor.css'

export function Layout() {
  return (
    <div className="ed-root" style={{ ['--ed-serif' as string]: 'var(--font-newsreader)', ['--ed-sans' as string]: 'ui-sans-serif, system-ui, sans-serif', ['--ed-mono' as string]: 'var(--font-plex-mono)' }}>
      <ReadingTheme />
      <Outlet />
    </div>
  )
}
export default Layout

export const meta = () => [{ title: 'Write' }, { name: 'robots', content: 'noindex, nofollow' }]

export async function indexLoader() {
  const { listPosts } = await import('@/lib/editor/server/posts')
  return { posts: listPosts() }
}

export function Index() {
  const { posts } = useLoaderData<typeof indexLoader>()
  return <PostIndex initial={posts} />
}

async function readOr404(slug: string) {
  const { SLUG_RE } = await import('@/lib/content/serialize')
  const { HttpError, readPost } = await import('@/lib/editor/server/posts')
  if (!SLUG_RE.test(slug)) throw new Response('Not found', { status: 404 })
  try {
    return readPost(slug)
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) throw new Response('Not found', { status: 404 })
    throw err
  }
}

export async function editLoader({ params }: LoaderFunctionArgs) {
  const { allTags, listPosts } = await import('@/lib/editor/server/posts')
  const slug = params.slug!
  const post = await readOr404(slug)
  const all = listPosts()
  return {
    post,
    allTags: allTags(),
    otherSlugs: all.filter((p) => p.id !== slug).flatMap((p) => [p.id, p.slug]),
    projects: all.filter((p) => p.kind === 'project' && p.id !== slug).map((p) => ({ slug: p.slug, title: p.title })),
  }
}

export function Edit() {
  const d = useLoaderData<typeof editLoader>()
  return <PostEditor key={d.post.id} post={d.post} allTags={d.allTags} otherSlugs={d.otherSlugs} projects={d.projects} />
}

export async function previewLoader({ params }: LoaderFunctionArgs) {
  const { markdownToHast } = await import('@/lib/content/render')
  const post = await readOr404(params.slug!)
  return { slug: params.slug!, frontmatter: post.frontmatter, readingMinutes: Math.max(1, Math.round(post.body.split(/\s+/).filter(Boolean).length / 220)), hast: await markdownToHast(post.body) }
}

export function Preview() {
  const { slug, frontmatter: fm, readingMinutes, hast } = useLoaderData<typeof previewLoader>()
  return (
    <div className="ed-preview">
      <div className="ed-preview__bar">
        <Link href={`/write/${slug}`} className="ed-btn-text">
          Back to editor
        </Link>
        <span className="ed-meta">{fm.draft ? 'Draft preview' : 'Published'} · rendered by lib/content/render.tsx</span>
      </div>
      <article className="ed-page">
        <p className="ed-eyebrow">
          {fm.kind === 'article' ? 'Writing' : 'Project'} · {readingMinutes} min read
        </p>
        <h1 className="ed-title ed-title--static">{fm.title}</h1>
        <div className="prose ed-prose">{hastToReact(hast as Root)}</div>
      </article>
    </div>
  )
}
