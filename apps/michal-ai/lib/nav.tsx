// The one place components get routing from. Replaces next/link and next/navigation; implemented on React Router.
import { forwardRef, useSyncExternalStore, type AnchorHTMLAttributes, type ReactNode } from 'react'
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

// Route changes run as view transitions where the browser has them and motion is allowed (see components/site/CardTransitions.tsx).
// React Router starts the transition only after the destination's loader data is in and commits the new page synchronously inside
// it, so the old page stays live and clickable while data loads and the freeze is the commit alone, never the network.
const QUERY = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (cb: () => void) => {
  const mq = matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const canTransition = () => typeof document !== 'undefined' && 'startViewTransition' in document && !matchMedia(QUERY).matches
/** True when a navigation should be wrapped in a view transition. False on the server and for the first client render (hydration safe). */
export function useRouteTransitions() {
  return useSyncExternalStore(subscribeMotion, canTransition, () => false)
}

const InRouterLink = forwardRef<HTMLAnchorElement, LinkProps>(function InRouterLink({ href, prefetch: _prefetch, scroll, replace, children, onClick, target, ...rest }, ref) {
  void _prefetch
  const navigate = useNavigate()
  const vt = useRouteTransitions()
  const to = currentHref(href)
  return (
    <RRLink
      ref={ref}
      to={to}
      target={target}
      replace={replace}
      preventScrollReset={scroll === false}
      discover="none"
      prefetch="intent"
      onClick={(e) => {
        onClick?.(e)
        // A plain left click becomes a view-transition navigation that commits synchronously (`flushSync`; the Link prop of that name
        // is not in the types, the navigate option is). Anything else (new tab, modifier keys, download) stays React Router's.
        if (!vt || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (target && target !== '_self') || rest.download != null) return
        e.preventDefault()
        void navigate(to, { replace, preventScrollReset: scroll === false, viewTransition: true, flushSync: true })
      }}
      {...rest}
    >
      {children}
    </RRLink>
  )
})

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  // Outside a router (unit tests that render markdown to static HTML) a plain anchor is exactly what the router would output.
  const inRouter = useInRouterContext()
  if (!inRouter || !isInternal(props.href)) {
    const { href, prefetch: _prefetch, scroll: _scroll, replace: _replace, children, ...rest } = props
    void _prefetch
    void _scroll
    void _replace
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )
  }
  return <InRouterLink ref={ref} {...props} />
})

export function usePathname() {
  return useLocation().pathname
}

export function useRouter() {
  const navigate = useNavigate()
  const vt = useRouteTransitions()
  const opts = { viewTransition: vt, flushSync: vt }
  return {
    push: (to: string) => void navigate(currentHref(to), opts),
    replace: (to: string) => void navigate(currentHref(to), { replace: true, ...opts }),
    back: () => void navigate(-1),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  }
}

export default Link
