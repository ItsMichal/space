// Entry of the hosted editor (Worker `write`, write.michal.ai). A client-only SPA around the same components as the local /write
// routes (app/dev/write.tsx); data comes from the Worker's /api/write/*, which reads and commits through GitHub. See docs/write.md.
import '../app/styles/fonts.css'
import '../app/globals.css'
import '../app/styles/craft.css'
import '../app/styles/type.css'
import '../app/write/editor.css'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, isRouteErrorResponse, Outlet, redirect, RouterProvider, useLoaderData, useRouteError, type LoaderFunctionArgs } from 'react-router'
import { PostEditor } from '@/components/editor/PostEditor'
import { PostIndex } from '@/components/editor/PostIndex'
import { WritePreview, WriteShell, editContext, readingMinutes } from '@/components/editor/WriteViews'
import { ApiError, api } from '@/lib/editor/client/api'
import { setEditorHost } from '@/lib/editor/client/host'

setEditorHost({ hosted: true, siteOrigin: 'https://michal.ai' })

async function readOr404(slug: string) {
  try {
    return await api.read(slug)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) throw new Response('Not found', { status: 404 })
    throw err
  }
}

async function indexLoader() {
  return (await api.list()).posts
}

async function editLoader({ params }: LoaderFunctionArgs) {
  const [post, { posts }] = await Promise.all([readOr404(params.slug!), api.list()])
  return { post, ...editContext(posts, params.slug!) }
}

async function previewLoader({ params }: LoaderFunctionArgs) {
  const [post, { markdownToHast }] = await Promise.all([readOr404(params.slug!), import('@/lib/content/render')])
  return { slug: params.slug!, frontmatter: post.frontmatter, minutes: readingMinutes(post.body), hast: await markdownToHast(post.body) }
}

function Index() {
  return <PostIndex initial={useLoaderData<typeof indexLoader>()} />
}

function Edit() {
  const d = useLoaderData<typeof editLoader>()
  return <PostEditor key={d.post.id} post={d.post} allTags={d.allTags} otherSlugs={d.otherSlugs} projects={d.projects} />
}

function Preview() {
  const d = useLoaderData<typeof previewLoader>()
  return <WritePreview {...d} note={d.frontmatter.draft ? 'from its branch' : 'from its branch, not yet live'} />
}

function Failure() {
  const err = useRouteError()
  const message = isRouteErrorResponse(err) ? (err.status === 404 ? 'No post with that slug.' : `${err.status} ${err.statusText}`) : err instanceof Error ? err.message : 'Something went wrong.'
  return (
    <WriteShell>
      <div className="ed-index">
        <p className="ed-warn">{message}</p>
        <a className="ed-btn-text" href="/write">
          Back to posts
        </a>
      </div>
    </WriteShell>
  )
}

const router = createBrowserRouter([
  { path: '/', loader: () => redirect('/write') },
  {
    path: '/write',
    element: (
      <WriteShell>
        <Outlet />
      </WriteShell>
    ),
    errorElement: <Failure />,
    children: [
      { index: true, loader: indexLoader, Component: Index },
      { path: ':slug', loader: editLoader, Component: Edit },
      { path: ':slug/preview', loader: previewLoader, Component: Preview },
    ],
  },
  { path: '*', loader: () => redirect('/write') },
])

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
