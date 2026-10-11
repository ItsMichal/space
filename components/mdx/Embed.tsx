export function Embed({ url, title = 'Embedded content', ratio = '16 / 9' }: { url: string; title?: string; ratio?: string }) {
  if (!/^https:\/\//.test(url)) return null
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
