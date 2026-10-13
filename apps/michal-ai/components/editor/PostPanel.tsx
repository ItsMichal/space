'use client'
import { ImagePlus, TriangleAlert, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { GalleryItem, PostFrontmatter, PostKind, PostLink } from '@/lib/content/types'
import { SLUG_RE, slugify } from '@/lib/content/serialize'
import { api } from '@/lib/editor/client/api'
import { uiBus } from '@/lib/editor/ui-bus'

type Props = {
  slug: string
  fm: PostFrontmatter
  onChange(patch: Partial<PostFrontmatter>): void
  allTags: string[]
  otherSlugs: string[]
  projects: { slug: string; title: string }[]
  onApplySlug(slug: string): void
}

function Field({ label, hint, children, htmlFor }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="ed-field">
      <label className="ed-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="ed-hint">{hint}</p> : null}
    </div>
  )
}

function TagInput({ tags, all, onChange }: { tags: string[]; all: string[]; onChange(tags: string[]): void }) {
  const [draft, setDraft] = useState('')
  const list = useId()
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }
  return (
    <div className="ed-tags">
      {tags.map((t) => (
        <span key={t} className="ed-tag">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X size={12} strokeWidth={1.5} />
          </button>
        </span>
      ))}
      <input
        list={list}
        value={draft}
        placeholder={tags.length ? '' : 'Add a tag'}
        aria-label="Add tag"
        onChange={(e) => {
          const v = e.target.value
          // picking a datalist option or typing a comma commits the tag
          const inputType = (e.nativeEvent as InputEvent).inputType
          if (v.endsWith(',')) add(v.slice(0, -1))
          else if (all.includes(v) && (!inputType || inputType === 'insertReplacementText')) add(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id={list}>
        {all.filter((t) => !tags.includes(t)).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  )
}

function RowsEditor<T extends Record<string, string | undefined>>({
  rows,
  fields,
  blank,
  addLabel,
  onChange,
}: {
  rows: T[]
  fields: { key: keyof T & string; label: string; type?: string }[]
  blank: T
  addLabel: string
  onChange(rows: T[]): void
}) {
  return (
    <div className="ed-rows">
      {rows.map((row, i) => (
        <div key={i} className="ed-rowset">
          {fields.map((f) => (
            <input
              key={f.key}
              className="ed-input"
              type={f.type ?? 'text'}
              aria-label={`${f.label} ${i + 1}`}
              placeholder={f.label}
              value={row[f.key] ?? ''}
              onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value || (f.key === 'caption' ? undefined : '') } : r)))}
            />
          ))}
          <button type="button" className="ed-btn-text" aria-label={`Remove row ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}
      <button type="button" className="ed-btn-text" onClick={() => onChange([...rows, blank])}>
        {addLabel}
      </button>
    </div>
  )
}

export function PostPanel({ slug, fm, onChange, allTags, otherSlugs, projects, onApplySlug }: Props) {
  const [slugDraft, setSlugDraft] = useState(fm.slug)
  const [busy, setBusy] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const ids = { desc: useId(), slug: useId(), date: useId(), updated: useId(), prio: useId(), canon: useId(), alt: useId(), kind: useId(), parent: useId(), series: useId(), order: useId(), role: useId(), years: useId(), hook: useId(), focus: useId() }

  const slugError = !slugDraft
    ? 'Slug is required.'
    : !SLUG_RE.test(slugDraft)
      ? 'Use lowercase letters, numbers and dashes only.'
      : slugDraft !== slug && otherSlugs.includes(slugDraft)
        ? 'Another post already uses this slug.'
        : null
  const slugChanged = slugDraft !== slug
  const published = !fm.draft
  const dLen = fm.description.length

  const uploadCover = async (file: File) => {
    setBusy(true)
    try {
      const res = await api.upload(slug, file)
      onChange({ cover: res.src })
      uiBus.emit('toast', { message: 'Cover uploaded. Add alt text for it.' })
    } catch (err) {
      uiBus.emit('toast', { message: err instanceof Error ? err.message : 'Upload failed', kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ed-panel__section">
      <Field label="Status">
        <div className="ed-row">
          <label className="ed-switch">
            <input type="checkbox" checked={Boolean(fm.draft)} onChange={(e) => onChange({ draft: e.target.checked ? true : undefined })} />
            <span aria-hidden />
            Draft
          </label>
          <select
            id={ids.kind}
            className="ed-select"
            aria-label="Kind"
            value={fm.kind}
            onChange={(e) => onChange({ kind: e.target.value as PostKind })}
          >
            <option value="article">Article (/writing)</option>
            <option value="project">Project (/projects)</option>
          </select>
        </div>
      </Field>

      {fm.kind === 'article' || fm.parent ? (
        <Field
          label="Parent project"
          htmlFor={ids.parent}
          hint={
            fm.parent
              ? `Lives at /projects/${fm.parent}/${slugDraft} and is listed on that project, not in Writing.`
              : 'None: this is a standalone post in Writing. Pick a project to make it part of its progress log.'
          }
        >
          <select
            id={ids.parent}
            className="ed-select"
            value={fm.parent ?? ''}
            onChange={(e) => onChange({ parent: e.target.value || undefined, ...(e.target.value ? {} : { series: undefined, order: undefined }) })}
          >
            <option value="">None (blog post)</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {fm.parent ? (
        <div className="ed-row ed-row--2">
          <Field label="List heading" htmlFor={ids.series} hint="e.g. Progress log">
            <input id={ids.series} className="ed-input" value={fm.series ?? ''} onChange={(e) => onChange({ series: e.target.value || undefined })} />
          </Field>
          <Field label="Order" htmlFor={ids.order} hint="Position in the list">
            <input
              id={ids.order}
              type="number"
              className="ed-input"
              value={fm.order ?? ''}
              onChange={(e) => onChange({ order: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Slug" htmlFor={ids.slug} hint={slugError ?? `${fm.parent ? `/projects/${fm.parent}` : fm.kind === 'article' ? '/writing' : '/projects'}/${slugDraft}`}>
        <div className="ed-row">
          <input
            id={ids.slug}
            className="ed-input ed-input--mono"
            value={slugDraft}
            aria-invalid={Boolean(slugError)}
            onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && !slugError && slugChanged && onApplySlug(slugDraft)}
          />
          <button type="button" className="ed-btn-text" onClick={() => setSlugDraft(slugify(fm.title))} title="Generate from title">
            From title
          </button>
          {slugChanged && !slugError ? (
            <button type="button" className="ed-btn-text ed-btn-text--solid" onClick={() => onApplySlug(slugDraft)}>
              Apply
            </button>
          ) : null}
        </div>
        {published && slugChanged ? (
          <p className="ed-warn">
            <TriangleAlert size={14} strokeWidth={1.5} aria-hidden /> This post is published. Changing its slug breaks existing links to it.
          </p>
        ) : null}
      </Field>

      <Field
        label="Description"
        htmlFor={ids.desc}
        hint={<span className={dLen >= 120 && dLen <= 160 ? 'is-ok' : dLen ? 'is-warn' : ''}>{dLen} / 160 · aim for 120 to 160</span>}
      >
        <textarea id={ids.desc} className="ed-input" rows={4} value={fm.description} onChange={(e) => onChange({ description: e.target.value })} />
      </Field>

      <div className="ed-row ed-row--2">
        <Field label="Date" htmlFor={ids.date}>
          <input id={ids.date} type="date" className="ed-input" value={fm.date} onChange={(e) => onChange({ date: e.target.value })} />
        </Field>
        <Field label="Updated" htmlFor={ids.updated}>
          <input
            id={ids.updated}
            type="date"
            className="ed-input"
            value={fm.updated ?? ''}
            onChange={(e) => onChange({ updated: e.target.value || undefined })}
          />
        </Field>
      </div>

      <Field label="Tags">
        <TagInput tags={fm.tags} all={allTags} onChange={(tags) => onChange({ tags })} />
      </Field>

      <Field label="Cover image">
        {fm.cover ? (
          <div className="ed-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fm.cover} alt={fm.coverAlt ?? ''} />
            <button type="button" aria-label="Remove cover" title="Remove cover" onClick={() => onChange({ cover: undefined, coverAlt: undefined })}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ) : null}
        <button type="button" className="ed-btn-text" disabled={busy} onClick={() => coverInput.current?.click()}>
          <ImagePlus size={16} strokeWidth={1.5} aria-hidden /> {fm.cover ? 'Replace' : 'Upload'} cover
        </button>
        <input
          ref={coverInput}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void uploadCover(f)
            e.target.value = ''
          }}
        />
      </Field>
      {fm.cover ? (
        <Field label="Cover alt text" htmlFor={ids.alt} hint={!fm.coverAlt?.trim() ? <span className="is-warn">Required for accessibility and SEO.</span> : undefined}>
          <input id={ids.alt} className="ed-input" value={fm.coverAlt ?? ''} onChange={(e) => onChange({ coverAlt: e.target.value || undefined })} />
        </Field>
      ) : null}

      {fm.cover ? (
        <Field label="Cover focus" htmlFor={ids.focus} hint="Where cropped covers stay centred, e.g. 50% 30%">
          <input id={ids.focus} className="ed-input ed-input--mono" value={fm.coverFocus ?? ''} onChange={(e) => onChange({ coverFocus: e.target.value || undefined })} />
        </Field>
      ) : null}

      {fm.kind === 'project' ? (
        <>
          <Field label="Role" htmlFor={ids.role}>
            <input id={ids.role} className="ed-input" value={fm.role ?? ''} onChange={(e) => onChange({ role: e.target.value || undefined })} />
          </Field>
          <Field label="Years (spec line)" htmlFor={ids.years}>
            <input id={ids.years} className="ed-input" placeholder="2024 to now" value={fm.years ?? ''} onChange={(e) => onChange({ years: e.target.value || undefined })} />
          </Field>
          <Field label="Hero hook" htmlFor={ids.hook} hint={`${(fm.hook ?? '').length} / 48 · finishes \"Lately I've built ...\" on the home page`}>
            <input id={ids.hook} className="ed-input" maxLength={48} placeholder="an AI that commentates Formula 1" value={fm.hook ?? ''} onChange={(e) => onChange({ hook: e.target.value || undefined })} />
          </Field>
          <Field label="Featured">
            <label className="ed-switch">
              <input type="checkbox" checked={Boolean(fm.featured)} onChange={(e) => onChange({ featured: e.target.checked ? true : undefined })} />
              <span aria-hidden />
              Show large in Selected work
            </label>
          </Field>
        </>
      ) : null}
      <Field label="Links">
        <RowsEditor<PostLink>
          rows={fm.links ?? []}
          fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'https://', type: 'url' }]}
          blank={{ label: '', href: '' }}
          addLabel="Add link"
          onChange={(links) => onChange({ links: links.length ? links : undefined })}
        />
      </Field>
      <Field label="Gallery" hint="Images under /media. Alt text is required.">
        <RowsEditor<GalleryItem>
          rows={fm.gallery ?? []}
          fields={[{ key: 'src', label: '/media/…' }, { key: 'alt', label: 'Alt text' }, { key: 'caption', label: 'Caption' }]}
          blank={{ src: '', alt: '' }}
          addLabel="Add image"
          onChange={(gallery) => onChange({ gallery: gallery.length ? gallery : undefined })}
        />
      </Field>

      <div className="ed-row ed-row--2">
        <Field label="Priority" htmlFor={ids.prio} hint="Higher sorts first">
          <input
            id={ids.prio}
            type="number"
            className="ed-input"
            value={fm.priority ?? ''}
            onChange={(e) => onChange({ priority: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="Canonical URL" htmlFor={ids.canon} hint="Only if this was first published elsewhere">
        <input
          id={ids.canon}
          type="url"
          className="ed-input"
          placeholder="https://"
          value={fm.canonical ?? ''}
          onChange={(e) => onChange({ canonical: e.target.value || undefined })}
        />
      </Field>
    </div>
  )
}
