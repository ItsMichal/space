// A resume as plain data: what /resume prints, and what the editor (write.michal.ai, Resume) tailors per job and saves as
// resumes/<id>.json in the content repo. lib/resume/site.ts builds the site's own from content/profile.ts; a tailored one is a
// copy of it edited by hand. Text fields take a small inline markup (lib/resume/inline.tsx): **bold**, *italic*, [text](url).
// No imports: the editor's Worker checks saved files with parseResume and must not pull in the site's content.

export type ResumeBullet = { text: string; hidden?: boolean }

/** One entry. In an `entries` section: heading, detail, dates, then body, bullets and a muted meta line. In a `list` section: one
 *  run-in line ("**title**, *detail*<sep>body"), dates flush right. In `cites`: title and dates on a line, body under it. */
export type ResumeItem = {
  id: string
  title: string
  href?: string
  detail?: string
  dates?: string
  body?: string
  bullets?: ResumeBullet[]
  meta?: string
  hidden?: boolean
}

export type ResumeSection = {
  id: string
  title: string
  kind: 'entries' | 'list' | 'cites' | 'skills'
  /** In a `list` section, what joins the title (or its detail) to the body: ". " or ", ". */
  sep?: string
  hidden?: boolean
  items: ResumeItem[]
}

export type Paper = 'letter' | 'a4'

/** How the sheet is set on paper. `type` and `space` scale the print sizes (1 is the site's own 10pt text and its gaps). */
export type ResumeSetting = { paper: Paper; margin: number; type: number; space: number; fit: 'auto' | 'manual' }

export type ResumeDoc = {
  version: 1
  /** What it is for, shown in the editor only: "Anthropic, Staff+ Software Engineer, Claude Design". */
  target?: string
  /** The job posting it was written against, editor only. */
  job?: string
  notes?: string
  name: string
  /** The line under the name: role, place and links, joined by middle dots. */
  contact: { text: string; href?: string }[]
  sections: ResumeSection[]
  setting: ResumeSetting
}

export const PAPER: Record<Paper, { w: number; h: number; label: string }> = {
  letter: { w: 8.5, h: 11, label: 'US Letter' },
  a4: { w: 8.27, h: 11.69, label: 'A4' },
}

export const SETTING: ResumeSetting = { paper: 'letter', margin: 0.5, type: 1, space: 1, fit: 'auto' }
/** The range the fitter (lib/resume/fit.ts) and the editor's sliders keep to: never smaller than 8.8pt text, never airless. */
export const LIMITS = { type: [0.88, 1.08], space: [0.45, 1.8], margin: [0.35, 0.9] } as const

/* ---------------------------------------------------------------------------------------------- checking a saved file */

const MAX_TEXT = 1200
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A resume file's text, checked: a strict shape, size caps and safe link schemes. (Style, such as dashes, is the editor's to point out.) */
export function parseResume(text: string): { doc: ResumeDoc; problem?: undefined } | { doc?: undefined; problem: string } {
  if (text.length > 200_000) return { problem: 'resume file is over 200 KB' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { problem: 'not JSON' }
  }
  const problems: string[] = []
  const str = (v: unknown, where: string, opt = false): string | undefined => {
    if (v === undefined && opt) return undefined
    if (typeof v !== 'string') return void problems.push(`${where}: expected text`)
    if (v.length > MAX_TEXT) problems.push(`${where}: over ${MAX_TEXT} characters`)
    return v
  }
  const url = (v: unknown, where: string): string | undefined => {
    const s = str(v, where, true)
    if (s !== undefined && !/^(https:\/\/|mailto:|tel:)/.test(s)) problems.push(`${where}: links must be https, mailto or tel`)
    return s
  }
  const num = (v: unknown, where: string, [lo, hi]: readonly [number, number]) => {
    if (typeof v !== 'number' || !(v >= lo && v <= hi)) return void problems.push(`${where}: expected a number from ${lo} to ${hi}`)
    return v
  }
  const id = (v: unknown, where: string) => {
    if (typeof v !== 'string' || !ID.test(v) || v.length > 80) problems.push(`${where}: id must be lowercase words joined by hyphens`)
    return v as string
  }
  if (!isObj(raw) || raw.version !== 1) return { problem: 'not a version 1 resume' }
  const s = isObj(raw.setting) ? raw.setting : {}
  const doc: ResumeDoc = {
    version: 1,
    ...(raw.target !== undefined ? { target: str(raw.target, 'target') } : {}),
    ...(raw.job !== undefined ? { job: url(raw.job, 'job') } : {}),
    ...(raw.notes !== undefined ? { notes: typeof raw.notes === 'string' && raw.notes.length <= 20_000 ? raw.notes : void problems.push('notes: over 20000 characters') } : {}),
    name: str(raw.name, 'name') ?? '',
    contact: Array.isArray(raw.contact)
      ? raw.contact.slice(0, 12).map((c, i) => (isObj(c) ? { text: str(c.text, `contact ${i + 1}`) ?? '', ...(c.href !== undefined ? { href: url(c.href, `contact ${i + 1} link`) } : {}) } : { text: '' }))
      : [],
    sections: [],
    setting: {
      paper: s.paper === 'a4' ? 'a4' : s.paper === 'letter' ? 'letter' : (problems.push('setting.paper: letter or a4'), 'letter'),
      margin: num(s.margin, 'setting.margin', LIMITS.margin) ?? SETTING.margin,
      type: num(s.type, 'setting.type', LIMITS.type) ?? 1,
      space: num(s.space, 'setting.space', LIMITS.space) ?? 1,
      fit: s.fit === 'manual' ? 'manual' : 'auto',
    },
  }
  if (!Array.isArray(raw.sections) || raw.sections.length > 20) problems.push('sections: expected a list of at most 20')
  for (const [si, sec] of (Array.isArray(raw.sections) ? raw.sections : []).entries()) {
    const w = `section ${si + 1}`
    if (!isObj(sec) || !['entries', 'list', 'cites', 'skills'].includes(sec.kind as string)) {
      problems.push(`${w}: kind must be entries, list, cites or skills`)
      continue
    }
    const items: ResumeItem[] = []
    for (const [ii, it] of (Array.isArray(sec.items) ? sec.items.slice(0, 60) : []).entries()) {
      const wi = `${w}, item ${ii + 1}`
      if (!isObj(it)) continue
      items.push({
        id: id(it.id, wi),
        title: str(it.title, `${wi} title`) ?? '',
        ...(it.href !== undefined ? { href: url(it.href, `${wi} link`) } : {}),
        ...(it.detail !== undefined ? { detail: str(it.detail, `${wi} detail`) } : {}),
        ...(it.dates !== undefined ? { dates: str(it.dates, `${wi} dates`) } : {}),
        ...(it.body !== undefined ? { body: str(it.body, `${wi} text`) } : {}),
        ...(it.meta !== undefined ? { meta: str(it.meta, `${wi} meta`) } : {}),
        ...(Array.isArray(it.bullets)
          ? { bullets: it.bullets.slice(0, 20).map((b, bi) => ({ text: str(isObj(b) ? b.text : undefined, `${wi} bullet ${bi + 1}`) ?? '', ...(isObj(b) && b.hidden === true ? { hidden: true } : {}) })) }
          : {}),
        ...(it.hidden === true ? { hidden: true } : {}),
      })
    }
    doc.sections.push({
      id: id(sec.id, w),
      title: str(sec.title, `${w} title`) ?? '',
      kind: sec.kind as ResumeSection['kind'],
      ...(sec.sep !== undefined ? { sep: sec.sep === ', ' ? ', ' : '. ' } : {}),
      ...(sec.hidden === true ? { hidden: true } : {}),
      items,
    })
  }
  // Markup links: the same schemes as `href`.
  const all = JSON.stringify(doc)
  for (const m of all.matchAll(/\]\(([^)\s]*)\)/g)) if (!/^(https:\/\/|mailto:|tel:)/.test(m[1])) problems.push(`link "${m[1].slice(0, 60)}": must be https, mailto or tel`)
  return problems.length ? { problem: problems.slice(0, 8).join('; ') } : { doc }
}

/** The file's text: stable key order, two-space indent, trailing newline. */
export const serializeResume = (doc: ResumeDoc) => `${JSON.stringify(doc, null, 2)}\n`
