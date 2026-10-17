import { RATIO_RE, embedUrlOk } from '@/lib/content/rules.mjs'

/** An iframe for an allowlisted https host only (lib/content/rules.mjs EMBED_HOSTS); anything else renders nothing. */
export function Embed({ url, title = 'Embedded content', ratio = '16 / 9' }: { url: string; title?: string; ratio?: string }) {
  if (!embedUrlOk(url)) return null
  if (!RATIO_RE.test(ratio)) ratio = '16 / 9'
  return (
    <div className="embed" style={{ aspectRatio: ratio }}>
      <iframe
        src={url}
        title={title}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    </div>
  )
}
