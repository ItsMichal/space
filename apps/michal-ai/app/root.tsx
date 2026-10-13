import './styles/fonts.css'
import './globals.css'
import './styles/craft.css'
import './styles/type.css'
import './styles/card.css'
import './styles/transition.css'
import { Links, Meta, Outlet, Scripts, useLoaderData, useLocation, type LinksFunction } from 'react-router'
import { registerPosts } from '@/lib/content'
import { NavBar } from '@/components/site/NavBar'
import { CardTransitions } from '@/components/site/CardTransitions'
import { Footer } from '@/components/site/Footer'
import { PageEnd } from '@/components/site/PageEnd'
import { PaperGrid } from '@/components/site/PaperGrid'
import { ShaderCanvasProvider } from '@/components/shader-image'
import { Backdrop } from '@/components/backdrop/Backdrop'

// The same ten font files the previous build preloaded (the `.p.` ones), plus the hero globe still.
const PRELOAD_FONTS = [
  '3792c5f0958f6bcc-s.p.woff2',
  '5ed7d4ff5e59016d-s.p.woff2',
  '84adbee2f2a7cb50-s.p.woff2',
  '8edf6d3506a17285-s.p.woff2',
  '92eeb95d069020cc-s.p.woff2',
  '98e207f02528a563-s.p.woff2',
  '99dcf268bda04fe5-s.p.woff2',
  'bb2798ad86f95cff-s.p.woff2',
  'd3ebbfd689654d3a-s.p.woff2',
  'fe6c4b8cc116014d-s.p.woff2',
]
export const links: LinksFunction = () => PRELOAD_FONTS.map((f) => ({ rel: 'preload', href: `/fonts/${f}`, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }))

export async function loader() {
  const { slimAll } = await import('@/lib/rr/content.server')
  const { getMenuPreviews } = await import('@/lib/menu')
  const { getAllPosts, getChildren, getTopLevel } = await import('@/lib/content')
  const { postPath } = await import('@/lib/seo')
  const log = getTopLevel('project').find((p) => getChildren(p.slug).some((c) => c.kind === 'article'))
  return { posts: slimAll(getAllPosts()), previews: getMenuPreviews(), log: log ? { title: log.title, href: postPath(log) } : null }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // ReadingTheme's inline script sets data-reading on <html> before hydration, on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col font-sans text-ink">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const { posts, previews, log } = useLoaderData<typeof loader>()
  registerPosts(posts) // the browser build answers getAllPosts() from this (see lib/content/source.client.ts)
  const { pathname } = useLocation()
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <NavBar previews={previews} />
      <CardTransitions />
      <main id="main" className="relative flex-1">
        <PaperGrid />
        <Backdrop paths={['/shaders']} />
        <ShaderCanvasProvider>
          {/* Re-mounts on every navigation, so content fades up 8px / 240ms on route enter (was app/template.tsx). */}
          <div className="page-enter" key={pathname}>
            <Outlet />
          </div>
        </ShaderCanvasProvider>
      </main>
      <PageEnd log={log ?? undefined} />
      <Footer />
    </>
  )
}
