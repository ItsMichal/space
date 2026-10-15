import { siteConfig } from '@/site.config'
import { profile } from '@/content/profile'
import { NextLinks, type NextLink } from './NextLinks'

/**
 * The end of every page: plain link names to where to go next, only to destinations that already exist (the nav's
 * sections, the project that keeps a progress log, and the elsewhere links from the footer). One block, same on every
 * route, so no page ends on a dead stop or a giant image.
 */
export function PageEnd({ log }: { log?: { title: string; href: string } }) {
  const links: NextLink[] = [
    { label: 'Work', href: '/projects' },
    { label: 'Writing', href: '/writing' },
    ...(log ? [{ label: log.title, href: log.href }] : []),
    { label: 'About', href: '/about' },
    ...(profile.publications.length ? [{ label: 'Publications', href: '/about#publications' }] : []),
    { label: 'Resume', href: '/resume' },
    { label: 'LinkedIn', href: siteConfig.linkedin, external: true },
    { label: 'GitHub', href: siteConfig.github, external: true },
  ]
  return (
    <div className="mx-auto mt-space-12 w-full max-w-content px-space-4 md:px-space-8">
      <NextLinks label="More" links={links} />
    </div>
  )
}
