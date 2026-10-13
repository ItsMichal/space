'use client'
import { FilePlus2, Trash2 } from 'lucide-react'
import Link from '@/lib/nav'
import { useRouter } from '@/lib/nav'
import { useMemo, useState } from 'react'
import type { PostKind } from '@/lib/content/types'
import { api } from '@/lib/editor/client/api'
import type { PostSummary } from '@/lib/editor/server/posts'

type Filter = 'all' | 'draft' | 'published'

export function PostIndex({ initial }: { initial: PostSummary[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [kind, setKind] = useState<PostKind>('article')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const posts = useMemo(
    () => initial.filter((p) => filter === 'all' || (filter === 'draft' ? p.draft : !p.draft)),
    [initial, filter]
  )

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const post = await api.create({ kind })
      router.push(`/write/${post.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the post')
      setBusy(false)
    }
  }

  const trash = async (id: string, title: string) => {
    if (!window.confirm(`Move "${title}" to content/.trash? You can restore it from there with git or the file manager.`)) return
    try {
      await api.trash(id)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
    }
  }

  return (
    <div className="ed-index">
      <header className="ed-index__head">
        <div>
          <p className="ed-eyebrow">Writing tool · local only</p>
          <h1 className="ed-display">Posts</h1>
        </div>
        <div className="ed-row">
          <select className="ed-select" aria-label="Kind of new post" value={kind} onChange={(e) => setKind(e.target.value as PostKind)}>
            <option value="article">Article</option>
            <option value="project">Project</option>
          </select>
          <button type="button" className="ed-publish" onClick={() => void create()} disabled={busy}>
            <FilePlus2 size={16} strokeWidth={1.5} aria-hidden /> New post
          </button>
        </div>
      </header>

      <div className="ed-filters" role="tablist" aria-label="Filter posts">
        {(['all', 'draft', 'published'] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? `All ${initial.length}` : f === 'draft' ? `Drafts ${initial.filter((p) => p.draft).length}` : `Published ${initial.filter((p) => !p.draft).length}`}
          </button>
        ))}
      </div>
      {error ? <p className="ed-warn">{error}</p> : null}

      <ul className="ed-rows">
        {posts.map((p) => (
          <li key={p.id} className="ed-prow">
            <Link href={`/write/${p.id}`} className="ed-prow__main">
              <span className="ed-prow__title">{p.title || 'Untitled'}</span>
              <span className="ed-prow__desc">{p.description || 'No description'}</span>
            </Link>
            <span className="ed-prow__meta">
              <span className={`ed-pill ${p.draft ? 'is-draft' : 'is-live'}`}>{p.draft ? 'Draft' : 'Published'}</span>
              {p.kind} · {p.updated ?? p.date} · {p.words.toLocaleString()} words
            </span>
            <button type="button" className="ed-btn ed-prow__trash" aria-label={`Move ${p.title} to trash`} title="Move to trash" onClick={() => void trash(p.id, p.title)}>
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </li>
        ))}
        {!posts.length ? <li className="ed-hint">Nothing here yet.</li> : null}
      </ul>
    </div>
  )
}
