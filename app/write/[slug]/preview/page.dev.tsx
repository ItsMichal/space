// Draft preview: the same markdown pipeline as the public route (lib/content/render), but reads the file directly so
// drafts and not-yet-generated slugs work. Published posts should be previewed at their real route.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { renderMarkdown } from '@/lib/content/render'
import { SLUG_RE } from '@/lib/content/serialize'
import { docStats } from '@/lib/editor/seo'
import { markdownToDoc } from '@/lib/editor/markdown'
import { HttpError, readPost } from '@/lib/editor/server/posts'

export const dynamic = 'force-dynamic'

export default async function PreviewPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_RE.test(slug)) notFound()
  let post
  try {
    post = readPost(slug)
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound()
    throw err
  }
  const { frontmatter: fm, body } = post
  const content = await renderMarkdown(body)
  const stats = docStats(markdownToDoc(body))
  return (
    <div className="ed-preview">
      <div className="ed-preview__bar">
        <Link href={`/write/${slug}`} className="ed-btn-text">
          Back to editor
        </Link>
        <span className="ed-meta">{fm.draft ? 'Draft preview' : 'Published'} · rendered by lib/content/render.tsx</span>
      </div>
      <article className="ed-page">
        <p className="ed-eyebrow">
          {fm.kind === 'article' ? 'Writing' : 'Project'} · {stats.readingMinutes} min read
        </p>
        <h1 className="ed-title ed-title--static">{fm.title}</h1>
        {fm.cover ? (
          <figure className="prose">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fm.cover} alt={fm.coverAlt ?? ''} />
          </figure>
        ) : null}
        <div className="prose ed-prose">{content}</div>
      </article>
    </div>
  )
}
