import { getChildren, getTopLevel } from '@/lib/content'
import { postPath } from '@/lib/seo'
import { siteConfig } from '@/site.config'
import { NextLinks, type NextLink } from './NextLinks'

/**
 * The end of every page: plain link names to where to go next, only to destinations that already exist (the nav's
 * sections, the project that keeps a progress log, and the elsewhere links from the footer). One block, same on every
 * route, so no page ends on a dead stop or a giant image.
 */
export function PageEnd() {
  const log = getTopLevel('project').find((p) => getChildren(p.slug).some((c) => c.kind === 'article'))
  const links: NextLink[] = [
    { label: 'Work', href: '/projects' },
    { label: 'Writing', href: '/writing' },
    ...(log ? [{ label: log.title, href: postPath(log) }] : []),
    { label: 'Resume', href: '/BodzianowskiResume.pdf', external: true },
    { label: 'LinkedIn', href: siteConfig.linkedin, external: true },
    { label: 'GitHub', href: siteConfig.github, external: true },
  ]
  return (
    <div className="mx-auto mt-space-16 max-w-content px-space-4 md:px-space-8">
      <NextLinks label="More" links={links} />
    </div>
  )
}
