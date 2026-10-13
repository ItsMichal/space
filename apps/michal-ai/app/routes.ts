import { index, route, type RouteConfig } from '@react-router/dev/routes'

// Route table. Dev-only tools (writing editor, design labs) are appended in development only, so production never contains them.
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
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig
