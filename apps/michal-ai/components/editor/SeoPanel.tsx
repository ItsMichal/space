'use client'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import type { PostFrontmatter } from '@/lib/content/types'
import { FALLBACK_OG_IMAGE, SITE_URL, analyzeSeo, fullTitle, postUrl, truncate, type DocStats } from '@/lib/editor/seo'

const ICON = {
  ok: <CircleCheck size={16} strokeWidth={1.5} aria-hidden />,
  warn: <TriangleAlert size={16} strokeWidth={1.5} aria-hidden />,
  error: <CircleAlert size={16} strokeWidth={1.5} aria-hidden />,
}

export function SeoPanel({ fm, stats }: { fm: PostFrontmatter; stats: DocStats }) {
  const checks = analyzeSeo(fm, stats)
  const url = postUrl(fm)
  const crumbs = url.replace(/^https:\/\//, '').split('/').join(' › ')
  const image = fm.cover ?? FALLBACK_OG_IMAGE
  const domain = new URL(SITE_URL).hostname

  return (
    <div className="ed-panel__section">
      <div className="ed-field">
        <p className="ed-label">Checks</p>
        <ul className="ed-checks">
          {checks.map((c) => (
            <li key={c.id} className={`is-${c.level}`}>
              {ICON[c.level]}
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ed-field">
        <p className="ed-label">Search result</p>
        <div className="ed-serp">
          <p className="ed-serp__url">{crumbs}</p>
          <p className="ed-serp__title">{truncate(fullTitle(fm.title), 60)}</p>
          <p className="ed-serp__desc">
            <span>{fm.date}</span> {'·'} {truncate(fm.description || 'No description yet. Google will pick text from the page instead.', 160)}
          </p>
        </div>
      </div>

      <div className="ed-field">
        <p className="ed-label">Link preview (Open Graph)</p>
        <div className="ed-og">
          <img src={image} alt={fm.coverAlt ?? ''} />
          <div>
            <p className="ed-og__domain">{domain}</p>
            <p className="ed-og__title">{fm.title || 'Untitled'}</p>
            <p className="ed-og__desc">{truncate(fm.description, 110)}</p>
          </div>
        </div>
      </div>

      <div className="ed-field">
        <p className="ed-label">Outline</p>
        {stats.headings.length ? (
          <ul className="ed-outline">
            {stats.headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.level - 2) * 14 }}>
                <span>H{h.level}</span> {h.text || <em>empty</em>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ed-hint">No headings yet.</p>
        )}
        <p className="ed-hint">
          {stats.words.toLocaleString()} words · {stats.readingMinutes} min read · {stats.images.length} image{stats.images.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}
