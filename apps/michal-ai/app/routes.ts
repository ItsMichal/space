import { index, route, type RouteConfig } from '@react-router/dev/routes'

// Dev-only tools (the design labs). Only `react-router dev` sets NODE_ENV to "development"; any build leaves them out, so
// production output can never contain them (asserted by lib/rr/routes.test.ts). The writing editor is not here at all: it lives
// in ItsMichal/space-content and is served at write.michal.ai.
const dev: RouteConfig =
  process.env.NODE_ENV === 'development'
    ? [
        route('cards', 'cards/page.dev.tsx'),
        route('glass', 'glass/page.dev.tsx'),
        route('glass/matrix', 'glass/matrix/page.dev.tsx'),
        route('kitchen-sink', 'dev/kitchen-sink.tsx'),
        route('micro', 'micro/page.dev.tsx'),
        route('mood', 'mood/page.dev.tsx'),
        route('mood/a', 'mood/a/page.dev.tsx'),
        route('mood/b', 'mood/b/page.dev.tsx'),
        route('mood/c', 'mood/c/page.dev.tsx'),
        route('motion', 'motion/page.dev.tsx'),
        route('presence', 'dev/presence.tsx'),
        route('shaders', 'shaders/page.dev.tsx'),
        route('ui', 'ui/page.dev.tsx'),
      ]
    : []

export default [
  index('routes/home.tsx'),
  route('projects', 'routes/projects.tsx'),
  route('projects/:slug', 'routes/post.tsx', { id: 'post-project' }),
  route('projects/:slug/:child', 'routes/post.tsx', { id: 'post-child' }),
  route('writing', 'routes/writing.tsx'),
  route('writing/:slug', 'routes/post.tsx', { id: 'post-article' }),
  route('about', 'routes/about.tsx'),
  route('resume', 'routes/resume.tsx'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route('manifest.webmanifest', 'routes/manifest.ts'),
  route('feed.xml', 'routes/feed-xml.ts'),
  route('feed.json', 'routes/feed-json.ts'),
  route('projects/:slug/feed.xml', 'routes/project-feed.ts'),
  ...dev,
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig
