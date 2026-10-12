import { ArrowUpRight } from 'lucide-react'
import { HALMIC_DOMAIN, halmicLinkFor } from '@space/crosslinks'
import { OtherSiteMark } from '@/components/site/SiteSwitcher'

/** The sibling-site link for a post that is also on the other site, or undefined. Rendered from packages/crosslinks/src/pairs.mjs, never from the post body. */
export const otherSiteFor = (postId: string) => halmicLinkFor(postId)

/** Mark, domain and the other site's own title for the piece, as a plain followed link (rel="me", same tab). */
export function OtherSiteAnchor({ href, title, className }: { href: string; title: string; className?: string }) {
  return (
    <a href={href} rel="me" className={className}>
      <OtherSiteMark height={14} />
      <span>
        {HALMIC_DOMAIN}
        {' · '}
        {title}
      </span>
      <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
    </a>
  )
}

/** End of an article, before series and previous/next: one quiet line, same voice as "Originally published on ...". */
export function OtherSiteEnd({ postId }: { postId: string }) {
  const link = otherSiteFor(postId)
  if (!link) return null
  return (
    <p className="mt-space-12 font-serif text-[16px] italic text-ink-muted">
      Also on <OtherSiteAnchor href={link.href} title={link.title} className="link inline-flex min-h-[44px] items-center gap-[6px] not-italic" />
    </p>
  )
}
