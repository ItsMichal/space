// The one place components get routing from. Replaces next/link and next/navigation; implemented on React Router.
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import legacy from '@/content/redirects.json'
import { Link as RRLink, useInRouterContext, useLocation, useNavigate } from 'react-router'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children?: ReactNode
  /** Accepted for source compatibility with next/link; React Router prefetches on intent via `prefetch`. */
  prefetch?: boolean
  scroll?: boolean
  replace?: boolean
}

// An in-app link to a renamed page goes straight to its current URL, as the Worker's 308 would for a full page load (client navigation
// fetches loader data for the path it is given, which does not exist for an old slug).
const LEGACY = new Map(Object.entries(legacy as Record<string, { from: string[] }>).flatMap(([to, e]) => e.from.map((f) => [f, to] as const)))
export function currentHref(href: string): string {
  const m = /^([^?#]*)(.*)$/.exec(href)!
  const path = m[1].length > 1 ? m[1].replace(/\/+$/, '') : m[1]
  const to = LEGACY.get(path)
  return to ? to + m[2] : href
}

const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//')

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, prefetch: _prefetch, scroll, replace, children, ...rest }, ref) {
  // Outside a router (unit tests that render markdown to static HTML) a plain anchor is exactly what the router would output.
  void _prefetch
  const inRouter = useInRouterContext()
  if (!inRouter || !isInternal(href)) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <RRLink ref={ref} to={currentHref(href)} replace={replace} preventScrollReset={scroll === false} discover="none" prefetch="intent" {...rest}>
      {children}
    </RRLink>
  )
})

export function usePathname() {
  return useLocation().pathname
}

export function useRouter() {
  const navigate = useNavigate()
  return {
    push: (to: string) => void navigate(currentHref(to)),
    replace: (to: string) => void navigate(currentHref(to), { replace: true }),
    back: () => void navigate(-1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  }
}

export default Link
