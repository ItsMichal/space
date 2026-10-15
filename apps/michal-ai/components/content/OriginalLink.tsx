import { originalSite } from '@/lib/seo'

/** Quiet attribution at the end of a post that first appeared elsewhere (`originalUrl` in the frontmatter). */
export function OriginalLink({ url }: { url?: string }) {
  if (!url) return null
  const site = originalSite(url)
  return (
    <p className="mt-space-12 font-serif text-small italic text-ink-muted">
      Originally published{site ? ' on ' : ' '}
      <a href={url} className="link" rel="noopener noreferrer" target="_blank">
        {site ?? 'here'}
      </a>
    </p>
  )
}
