export function YouTube({ id, title = 'YouTube video' }: { id: string; title?: string }) {
  return (
    <div className="embed embed--youtube" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    </div>
  )
}
