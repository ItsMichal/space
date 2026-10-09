'use client'
import { EditorContent, useEditor } from '@tiptap/react'
import { ArrowLeft, Eye, Focus, PanelRight, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PostFrontmatter } from '@/lib/content/types'
import { slugify } from '@/lib/content/serialize'
import { ApiError, api, type LoadedPost } from '@/lib/editor/client/api'
import { buildTiptapExtensions } from '@/lib/editor/extensions'
import { docToMarkdown, markdownToDoc } from '@/lib/editor/markdown'
import { docStats, type DocStats } from '@/lib/editor/seo'
import { uiBus } from '@/lib/editor/ui-bus'
import { LinkPopover } from './LinkPopover'
import { PostPanel } from './PostPanel'
import { SeoPanel } from './SeoPanel'
import { SlashMenu } from './SlashMenu'
import { Toasts } from './Toasts'
import { Bubble, Toolbar } from './Toolbar'

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'

const AUTOSAVE_MS = 1200
const today = () => new Date().toLocaleDateString('en-CA')

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

type Props = { post: LoadedPost; allTags: string[]; otherSlugs: string[] }

export function PostEditor({ post, allTags, otherSlugs }: Props) {
  const router = useRouter()
  const slug = post.id

  const [fm, setFm] = useState<PostFrontmatter>(post.frontmatter)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [, setNow] = useState(0)
  const [panelOpen, setPanelOpen] = useState(true)
  const [tab, setTab] = useState<'post' | 'seo'>('post')
  const [focusMode, setFocusMode] = useState(false)
  const [stats, setStats] = useState<DocStats>(() => docStats(markdownToDoc(post.body)))

  const fmRef = useRef(fm)
  fmRef.current = fm
  const hashRef = useRef(post.hash)
  const versionRef = useRef(0)
  const savingRef = useRef(false)
  const statusRef = useRef<Status>('idle')
  statusRef.current = status
  const queuedRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const statsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const autoSlugRef = useRef(post.frontmatter.slug === slugify(post.frontmatter.title) || /^untitled(-\d+)?$/.test(post.frontmatter.slug))

  const extensions = useMemo(
    () =>
      buildTiptapExtensions({
        upload: async (file) => {
          const res = await api.upload(slug, file)
          uiBus.emit('toast', { message: `Saved ${Math.round(res.bytes / 1024)} KB${res.converted ? ' (optimised to webp)' : ''}` })
          return res.src
        },
      }),
    [slug]
  )

  const editor = useEditor({
    extensions,
    content: useMemo(() => markdownToDoc(post.body), [post.body]),
    immediatelyRender: false,
    editorProps: { attributes: { class: 'ed-prose prose', 'aria-label': 'Article body', spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => {
      clearTimeout(statsTimer.current)
      statsTimer.current = setTimeout(() => setStats(docStats(e.getJSON())), 350)
    },
  })

  /* ------------------------------------------------------------------ saving */
  const save = useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (!editor) return
      if (savingRef.current) {
        queuedRef.current = true
        return
      }
      clearTimeout(timer.current)
      savingRef.current = true
      const startedAt = versionRef.current
      setStatus('saving')
      try {
        const body = docToMarkdown(editor.getJSON())
        const res = await api.save(slug, { frontmatter: fmRef.current, body, baseHash: hashRef.current, force: opts.force })
        hashRef.current = res.hash
        setSavedAt(Date.now())
        setError('')
        setStatus(versionRef.current === startedAt ? 'saved' : 'dirty')
        if (versionRef.current !== startedAt) queuedRef.current = true
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) setStatus('conflict')
        else {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Save failed')
        }
      } finally {
        savingRef.current = false
        if (queuedRef.current) {
          queuedRef.current = false
          timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
        }
      }
    },
    [editor, slug]
  )

  const markDirty = useCallback(() => {
    versionRef.current += 1
    setStatus((s) => (s === 'conflict' ? s : 'dirty'))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
  }, [save])

  // `onUpdate` above closes over the first render's markDirty, so route through a ref.
  const markDirtyRef = useRef(markDirty)
  markDirtyRef.current = markDirty
  useEffect(() => {
    if (!editor) return
    const fn = () => markDirtyRef.current()
    editor.on('update', fn)
    return () => void editor.off('update', fn)
  }, [editor])

  const update = useCallback((patch: Partial<PostFrontmatter>) => {
    const next = { ...fmRef.current, ...patch } as PostFrontmatter
    for (const k of Object.keys(next) as (keyof PostFrontmatter)[]) if (next[k] === undefined) delete (next as Record<string, unknown>)[k]
    fmRef.current = next // synchronous so a save right after update() sees it
    setFm(next)
    markDirtyRef.current()
  }, [])

  // Keep "Saved · Ns ago" fresh.
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  // Save shortcut, unload guard, and external-change detection on focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (versionRef.current && (statusRef.current === 'dirty' || statusRef.current === 'saving' || statusRef.current === 'error')) {
        e.preventDefault()
      }
    }
    const onFocus = async () => {
      if (savingRef.current) return
      try {
        const disk = await api.read(slug)
        if (disk.hash === hashRef.current) return
        if (statusRef.current === 'saved' || statusRef.current === 'idle') {
          uiBus.emit('toast', { message: 'File changed on disk. Reloaded.' })
          window.location.reload()
        } else setStatus('conflict')
      } catch {}
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('focus', onFocus)
    }
  }, [save, slug, router])
  /* -------------------------------------------------------------- actions */
  const published = !fm.draft

  const publish = async () => {
    update(published ? { draft: true } : { draft: undefined, ...(fm.date !== today() ? { updated: today() } : {}) })
    await save()
    uiBus.emit('toast', {
      message: published ? 'Back to draft.' : 'Published. Commit the change to ship it.',
    })
  }

  const applySlug = async (next: string) => {
    clearTimeout(timer.current)
    if (savingRef.current) await new Promise((r) => setTimeout(r, 400))
    await save()
    try {
      await api.rename(slug, next)
      router.replace(`/write/${next}`)
    } catch (err) {
      uiBus.emit('toast', { message: err instanceof Error ? err.message : 'Rename failed', kind: 'error' })
    }
  }

  const livePath = `${fm.kind === 'article' ? '/writing' : '/projects'}/${slug}`
  const preview = async () => {
    await save()
    window.open(published ? livePath : `/write/${slug}/preview`, '_blank', 'noopener')
  }

  // The slug follows the title (applied on blur) until it is edited by hand or the post is published.
  const onTitleBlur = () => {
    const next = slugify(fm.title)
    if (autoSlugRef.current && !published && next && next !== slug && !otherSlugs.includes(next)) void applySlug(next)
  }

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = '0'
    el.style.height = `${el.scrollHeight}px`
  }, [fm.title])

  /* ---------------------------------------------------------------- render */
  const statusText: Record<Status, string> = {
    idle: savedAt ? `Saved · ${ago(savedAt)}` : 'Up to date',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: savedAt ? `Saved · ${ago(savedAt)}` : 'Saved',
    error: error || 'Save failed',
    conflict: 'Conflict',
  }

  return (
    <div className={`ed-shell${focusMode ? ' is-focus' : ''}${panelOpen ? ' has-panel' : ''}`}>
      <header className="ed-topbar">
        <Link href="/write" className="ed-btn-text" onClick={() => void save()}>
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden /> Posts
        </Link>
        <span className="ed-topbar__path" title={`content/posts/${slug}.md`}>
          content/posts/{slug}.md
        </span>
        <span className="ed-topbar__spacer" />
        <span className="ed-meta">
          {stats.words.toLocaleString()} words · {stats.readingMinutes} min
        </span>
        <button type="button" className={`ed-btn-text${focusMode ? ' is-on' : ''}`} aria-pressed={focusMode} onClick={() => setFocusMode((v) => !v)}>
          <Focus size={16} strokeWidth={1.5} aria-hidden /> Focus
        </button>
        <button type="button" className="ed-btn-text" onClick={() => void preview()} title={published ? 'Open the live route' : 'Drafts are not routable; opens the draft preview'}>
          <Eye size={16} strokeWidth={1.5} aria-hidden /> Preview
        </button>
        <button type="button" className={`ed-btn-text${panelOpen ? ' is-on' : ''}`} aria-pressed={panelOpen} aria-label="Toggle side panel" onClick={() => setPanelOpen((v) => !v)}>
          <PanelRight size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </header>

      {status === 'conflict' ? (
        <div className="ed-banner" role="alert">
          <TriangleAlert size={16} strokeWidth={1.5} aria-hidden />
          <span>
            <code>{slug}.md</code> changed on disk since you opened it (another editor or a git checkout).
          </span>
          <button type="button" className="ed-btn-text" onClick={() => window.location.reload()}>
            Reload from disk
          </button>
          <button type="button" className="ed-btn-text ed-btn-text--solid" onClick={() => void save({ force: true })}>
            Overwrite with mine
          </button>
        </div>
      ) : null}

      <div className="ed-body">
        <main className="ed-scroll">
          <div className="ed-page">
            <p className="ed-eyebrow">
              {fm.kind === 'article' ? 'Writing' : 'Project'} · {fm.draft ? 'Draft' : 'Published'}
            </p>
            <textarea
              ref={titleRef}
              className="ed-title"
              rows={1}
              placeholder="Title"
              aria-label="Title"
              value={fm.title}
              onChange={(e) => update({ title: e.target.value.replace(/\n/g, ' ') })}
              onBlur={onTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editor?.chain().focus('start').run()
                }
              }}
            />
            <EditorContent editor={editor} />
          </div>
        </main>

        {panelOpen ? (
          <aside className="ed-panel" aria-label="Post settings">
            <div className="ed-tabs" role="tablist">
              {(['post', 'seo'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
                  {t === 'post' ? 'Post' : 'SEO'}
                </button>
              ))}
            </div>
            {tab === 'post' ? (
              <PostPanel key={slug} slug={slug} fm={fm} onChange={update} allTags={allTags} otherSlugs={otherSlugs} onApplySlug={(s) => void applySlug(s)} />
            ) : (
              <SeoPanel fm={fm} stats={stats} />
            )}
          </aside>
        ) : null}
      </div>

      {editor ? (
        <>
          <Bubble editor={editor} />
          <LinkPopover editor={editor} />
          <Toolbar
            editor={editor}
            end={
              <>
                <span className={`ed-status is-${status}`} aria-live="polite">
                  {statusText[status]}
                </span>
                <button type="button" className="ed-publish" onClick={() => void publish()}>
                  {published ? 'Unpublish' : 'Publish'}
                </button>
              </>
            }
          />
        </>
      ) : null}
      <SlashMenu />
      <Toasts />
    </div>
  )
}
