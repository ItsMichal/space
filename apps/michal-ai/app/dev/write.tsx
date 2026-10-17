// Dev-only routes for the writing tool (/write, /write/:slug, /write/:slug/preview). Never part of a production build (see app/routes.ts).
// The loaders read and list posts from disk; the editor's save/upload API is the Vite dev middleware in vite/dev-api.ts.
// The hosted editor (write/) renders the same views from GitHub instead.
import { Outlet, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { PostIndex } from '@/components/editor/PostIndex'
import { PostEditor } from '@/components/editor/PostEditor'
import { WritePreview, WriteShell, editContext, readingMinutes } from '@/components/editor/WriteViews'
import '../write/editor.css'

export function Layout() {
  return (
    <WriteShell>
      <Outlet />
    </WriteShell>
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
  const { listPosts } = await import('@/lib/editor/server/posts')
  const slug = params.slug!
  const post = await readOr404(slug)
  return { post, ...editContext(listPosts(), slug) }
}

export function Edit() {
  const d = useLoaderData<typeof editLoader>()
  return <PostEditor key={d.post.id} post={d.post} allTags={d.allTags} otherSlugs={d.otherSlugs} projects={d.projects} />
}

export async function previewLoader({ params }: LoaderFunctionArgs) {
  const { markdownToHast } = await import('@/lib/content/render')
  const post = await readOr404(params.slug!)
  return { slug: params.slug!, frontmatter: post.frontmatter, readingMinutes: readingMinutes(post.body), hast: await markdownToHast(post.body) }
}

export function Preview() {
  const d = useLoaderData<typeof previewLoader>()
  return <WritePreview slug={d.slug} frontmatter={d.frontmatter} minutes={d.readingMinutes} hast={d.hast} note="rendered by lib/content/render.tsx" />
}
