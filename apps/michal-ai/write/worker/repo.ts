// The hosted editor's content store: GitHub instead of the working tree (compare lib/editor/server/posts.ts).
// Reads come from `main`, or from the post's editor branch `write/<slug>` when one exists. Saves commit to that branch through the
// Git Data API (blob, tree, commit, ref), creating it off main the first time. Consecutive editor commits on a branch are folded
// into one (the branch is moved with force), so a pull request carries one commit per post however often autosave ran; a commit
// someone else pushed to the branch is never folded away. Ship opens or updates the pull request. Nothing here merges.
import { parsePost, serializePost, slugify, SLUG_RE } from '../../lib/content/serialize'
import type { PostFrontmatter, PostKind } from '../../lib/content/types'
import { dashLines, frontmatterProblem, slugProblem } from '../../lib/editor/validate'
import type { PostFile, PostStatus, PostSummary, SaveInput, SaveResult, ShipResult, UploadResult } from '../../lib/editor/wire'
import type { GitHub } from './github'
import { HttpError, b64encode, sha1hex } from './http'

export type RepoConfig = { base: string; root: string; siteOrigin: string }

type Blob = { oid: string; text: string | null } | null
type Change = { path: string; content: string; encoding: 'utf-8' | 'base64' } | { path: string; sha: string | null }
type Commit = { sha: string; message: string; tree: { sha: string }; parents: { sha: string }[] }

const TRAILER = 'Write-Draft:'
const MAX_IMAGE = 10 * 1024 * 1024
const today = () => new Date().toISOString().slice(0, 10)
const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length

export function assertSlug(slug: string): string {
  if (!SLUG_RE.test(slug) || slug.length > 80) throw new HttpError(400, 'Invalid slug (use a-z, 0-9 and dashes)')
  return slug
}

export const branchOf = (slug: string) => `write/${slug}`

/** Image type from its first bytes (never from the name or the declared type). */
export function sniffImage(b: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | 'avif' | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (ascii(0, 4) === 'GIF8') return 'gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return 'avif'
  return null
}

const SNAPSHOT = `query Snapshot($owner: String!, $name: String!, $main: String!, $branch: String!, $ref: String!, $head: String!) {
  repository(owner: $owner, name: $name) {
    main: object(expression: $main) { ... on Blob { oid text } }
    branch: object(expression: $branch) { ... on Blob { oid text } }
    ref(qualifiedName: $ref) { name }
    pullRequests(headRefName: $head, states: OPEN, first: 1) { nodes { number url } }
  }
}`

const LIST = `query List($owner: String!, $name: String!, $posts: String!, $prefix: String!, $base: String!) {
  repository(owner: $owner, name: $name) {
    posts: object(expression: $posts) { ... on Tree { entries { name type object { ... on Blob { oid text } } } } }
    refs(refPrefix: $prefix, first: 100) { nodes { name } }
    pullRequests(baseRefName: $base, states: OPEN, first: 100) { nodes { number url headRefName } }
  }
}`

const TREE = `query Tree($owner: String!, $name: String!, $expr: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expr) { ... on Tree { entries { name type oid } } }
  }
}`

type Snapshot = { main: Blob; branch: Blob; branchExists: boolean; pr: { number: number; url: string } | null }

export class Repo {
  constructor(
    private gh: GitHub,
    private cfg: RepoConfig
  ) {}

  postPath = (slug: string) => `${this.cfg.root}/content/posts/${slug}.md`
  mediaPath = (slug: string) => `${this.cfg.root}/public/media/${slug}`
  private ghUrl = (p: string) => `https://github.com/${this.gh.owner}/${this.gh.repo}/${p}`

  /* ------------------------------------------------------------------ reads */

  async snapshot(slug: string): Promise<Snapshot> {
    const path = this.postPath(slug)
    const r = await this.gh.graphql<{
      repository: { main: Blob; branch: Blob; ref: { name: string } | null; pullRequests: { nodes: { number: number; url: string }[] } }
    }>(SNAPSHOT, { main: `${this.cfg.base}:${path}`, branch: `${branchOf(slug)}:${path}`, ref: `refs/heads/${branchOf(slug)}`, head: branchOf(slug) })
    const repo = r.repository
    return { main: repo.main?.oid ? repo.main : null, branch: repo.branch?.oid ? repo.branch : null, branchExists: Boolean(repo.ref), pr: repo.pullRequests.nodes[0] ?? null }
  }

  async list(): Promise<{ posts: PostSummary[]; tags: string[] }> {
    const r = await this.gh.graphql<{
      repository: {
        posts: { entries: { name: string; type: string; object: Blob }[] } | null
        refs: { nodes: { name: string }[] }
        pullRequests: { nodes: { number: number; url: string; headRefName: string }[] }
      }
    }>(LIST, { posts: `${this.cfg.base}:${this.cfg.root}/content/posts`, prefix: 'refs/heads/write/', base: this.cfg.base })
    const repo = r.repository
    const files = new Map<string, { text: string; onMain: boolean; branch: string | null }>()
    for (const e of repo.posts?.entries ?? []) {
      if (e.type === 'blob' && e.name.endsWith('.md') && e.object?.text != null) files.set(e.name.slice(0, -3), { text: e.object.text, onMain: true, branch: null })
    }
    const branches = repo.refs.nodes.map((n) => n.name).filter((s) => SLUG_RE.test(s))
    if (branches.length) {
      // One aliased query for every branch's copy of its post (slugs are validated, so they are safe in the alias and the variables).
      const vars = branches.map((_, i) => `$e${i}: String!`).join(', ')
      const fields = branches.map((_, i) => `b${i}: object(expression: $e${i}) { ... on Blob { oid text } }`).join('\n')
      const q = `query Branches($owner: String!, $name: String!, ${vars}) { repository(owner: $owner, name: $name) { ${fields} } }`
      const b = await this.gh.graphql<{ repository: Record<string, Blob> }>(q, Object.fromEntries(branches.map((s, i) => [`e${i}`, `${branchOf(s)}:${this.postPath(s)}`])))
      branches.forEach((s, i) => {
        const blob = b.repository[`b${i}`]
        if (blob?.text != null) files.set(s, { text: blob.text, onMain: files.get(s)?.onMain ?? false, branch: branchOf(s) })
      })
    }
    const prs = new Map(repo.pullRequests.nodes.map((p) => [p.headRefName, { number: p.number, url: p.url }]))
    const posts: PostSummary[] = [...files].map(([id, f]) => {
      const { frontmatter: fm, body } = parsePost(f.text, id)
      return {
        id,
        title: fm.title,
        slug: fm.slug,
        kind: fm.kind,
        date: fm.date,
        ...(fm.updated ? { updated: fm.updated } : {}),
        draft: Boolean(fm.draft),
        tags: fm.tags,
        description: fm.description,
        words: countWords(body),
        mtimeMs: 0,
        source: { onMain: f.onMain, branch: f.branch ?? (branches.includes(id) ? branchOf(id) : null), pr: prs.get(branchOf(id)) ?? null },
      }
    })
    posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
    return { posts, tags: [...new Set(posts.flatMap((p) => p.tags))].sort() }
  }

  async read(slug: string): Promise<PostFile> {
    assertSlug(slug)
    const s = await this.snapshot(slug)
    const blob = s.branch ?? s.main
    if (!blob || blob.text == null) throw new HttpError(404, 'Post not found')
    const { frontmatter, body } = parsePost(blob.text, slug)
    return { id: slug, frontmatter, body, hash: blob.oid, mtimeMs: Date.now(), source: { onMain: Boolean(s.main), branch: s.branchExists ? branchOf(slug) : null, pr: s.pr } }
  }

  async status(slug: string): Promise<PostStatus> {
    assertSlug(slug)
    const s = await this.snapshot(slug)
    const branch = s.branchExists ? branchOf(slug) : null
    return {
      onMain: Boolean(s.main),
      branch,
      pr: s.pr,
      branchUrl: branch ? this.ghUrl(`tree/${branch}`) : null,
      compareUrl: branch ? this.ghUrl(`compare/${this.cfg.base}...${branch}`) : null,
    }
  }

  /** A file's bytes from the post's branch, for previewing images that are not on the live site yet. */
  async branchFile(slug: string, file: string): Promise<Response | null> {
    assertSlug(slug)
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(file)) return null
    return this.gh.raw(`contents/${this.mediaPath(slug)}/${file}?ref=${encodeURIComponent(branchOf(slug))}`)
  }

  /* ----------------------------------------------------------------- writes */

  /**
   * Commit `changes` on top of branch `write/<from>` (or main when it does not exist yet) and point `write/<to>` at the result.
   * Returns the new blob shas by path.
   */
  async commit(opts: { from: string; to: string; changes: Change[]; message: string }): Promise<Record<string, string>> {
    const fromRef = await this.gh.rest<{ object: { sha: string } } | null>('GET', `git/ref/heads/${branchOf(opts.from)}`, undefined, { allow404: true })
    const baseSha = fromRef?.object.sha ?? (await this.gh.rest<{ object: { sha: string } }>('GET', `git/ref/heads/${this.cfg.base}`)).object.sha
    const head = await this.gh.rest<Commit>('GET', `git/commits/${baseSha}`)
    const fold = Boolean(fromRef) && head.parents.length === 1 && head.message.includes(`${TRAILER} ${opts.from}`)

    const shas: Record<string, string> = {}
    const tree = []
    for (const c of opts.changes) {
      if ('content' in c) {
        const blob = await this.gh.rest<{ sha: string }>('POST', 'git/blobs', { content: c.content, encoding: c.encoding })
        shas[c.path] = blob.sha
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha })
      } else tree.push({ path: c.path, mode: '100644', type: 'blob', sha: c.sha })
    }
    const newTree = await this.gh.rest<{ sha: string }>('POST', 'git/trees', { base_tree: head.tree.sha, tree })
    const parent = fold ? head.parents[0].sha : head.sha
    const commit = await this.gh.rest<{ sha: string }>('POST', 'git/commits', { message: `${opts.message}\n\n${TRAILER} ${opts.to}`, tree: newTree.sha, parents: [parent] })

    const toRef = `heads/${branchOf(opts.to)}`
    if (opts.from === opts.to && fromRef) await this.gh.rest('PATCH', `git/refs/${toRef}`, { sha: commit.sha, force: fold })
    else await this.gh.rest('POST', 'git/refs', { ref: `refs/${toRef}`, sha: commit.sha })
    return shas
  }

  private async parentExists(parent: string): Promise<boolean> {
    const s = await this.snapshot(parent)
    return Boolean(s.main ?? s.branch)
  }

  async save(slug: string, input: SaveInput): Promise<SaveResult> {
    assertSlug(slug)
    const problem = frontmatterProblem(slug, input.frontmatter)
    if (problem) throw new HttpError(400, problem)
    if (input.frontmatter.parent && !(await this.parentExists(input.frontmatter.parent))) throw new HttpError(400, `parent project "${input.frontmatter.parent}" does not exist`)
    const s = await this.snapshot(slug)
    const current = s.branch ?? s.main
    if (current && !input.force && input.baseHash && current.oid !== input.baseHash) {
      throw new HttpError(409, 'The post changed on GitHub since it was loaded', { currentHash: current.oid })
    }
    if (!current && input.baseHash && !input.force) throw new HttpError(409, 'The post no longer exists on GitHub (renamed or deleted)')
    const raw = serializePost(input.frontmatter, input.body)
    if (current?.text === raw) return { hash: current.oid, mtimeMs: Date.now() }
    const path = this.postPath(slug)
    const shas = await this.commit({ from: slug, to: slug, changes: [{ path, content: raw, encoding: 'utf-8' }], message: `Draft: ${input.frontmatter.title || slug}` })
    return { hash: shas[path], mtimeMs: Date.now() }
  }

  async create(input: { title?: string; kind?: PostKind }): Promise<PostFile> {
    const title = (input.title ?? '').trim() || 'Untitled'
    const { posts } = await this.list()
    const taken = new Set(posts.flatMap((p) => [p.id, p.slug]))
    const base = slugify(title) || 'untitled'
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
    const frontmatter: PostFrontmatter = { title, slug, id: slug, kind: input.kind === 'project' ? 'project' : 'article', description: '', date: today(), tags: [], draft: true }
    const path = this.postPath(slug)
    const shas = await this.commit({ from: slug, to: slug, changes: [{ path, content: serializePost(frontmatter, ''), encoding: 'utf-8' }], message: `Draft: ${title}` })
    return { id: slug, frontmatter, body: '', hash: shas[path], mtimeMs: Date.now(), source: { onMain: false, branch: branchOf(slug), pr: null } }
  }

  /** Only a draft that lives on its branch alone can be renamed here: its file, media folder and branch move together. */
  async rename(slug: string, next: string): Promise<PostFile> {
    assertSlug(slug)
    assertSlug(next)
    if (next === slug) return this.read(slug)
    const s = await this.snapshot(slug)
    if (s.main) throw new HttpError(409, 'This post is on main already; rename it in a pull request so a redirect can go with it')
    if (!s.branch?.text) throw new HttpError(404, 'Post not found')
    if (s.pr) throw new HttpError(409, `Pull request #${s.pr.number} is open for this post; rename it there`)
    const t = await this.snapshot(next)
    if (t.main || t.branchExists) throw new HttpError(409, 'A post with that slug already exists')

    const rewrite = (x: string) => x.split(`/media/${slug}/`).join(`/media/${next}/`)
    const { frontmatter, body } = parsePost(s.branch.text, slug)
    const fm: PostFrontmatter = {
      ...frontmatter,
      slug: next,
      ...(frontmatter.cover ? { cover: rewrite(frontmatter.cover) } : {}),
      ...(frontmatter.gallery ? { gallery: frontmatter.gallery.map((g) => ({ ...g, src: rewrite(g.src) })) } : {}),
    }
    const media = await this.gh.graphql<{ repository: { object: { entries: { name: string; type: string; oid: string }[] } | null } }>(TREE, {
      expr: `${branchOf(slug)}:${this.mediaPath(slug)}`,
    })
    const moves: Change[] = (media.repository.object?.entries ?? [])
      .filter((e) => e.type === 'blob')
      .flatMap((e) => [
        { path: `${this.mediaPath(next)}/${e.name}`, sha: e.oid },
        { path: `${this.mediaPath(slug)}/${e.name}`, sha: null },
      ])
    const path = this.postPath(next)
    const shas = await this.commit({
      from: slug,
      to: next,
      changes: [{ path, content: serializePost(fm, rewrite(body)), encoding: 'utf-8' }, { path: this.postPath(slug), sha: null }, ...moves],
      message: `Draft: ${fm.title || next}`,
    })
    await this.gh.rest('DELETE', `git/refs/heads/${branchOf(slug)}`) // its content now lives on write/<next>
    const parsed = parsePost(serializePost(fm, rewrite(body)), next)
    return { id: next, ...parsed, hash: shas[path], mtimeMs: Date.now(), source: { onMain: false, branch: branchOf(next), pr: null } }
  }

  async upload(slug: string, file: { name: string; bytes: Uint8Array; width: number; height: number; converted: boolean }): Promise<UploadResult> {
    assertSlug(slug)
    if (file.bytes.length > MAX_IMAGE) throw new HttpError(413, 'Image is larger than 10 MB')
    const ext = sniffImage(file.bytes)
    if (!ext) throw new HttpError(415, 'Only png, jpeg, webp, gif and avif are accepted')
    const s = await this.snapshot(slug)
    if (!s.main && !s.branch) throw new HttpError(404, 'Post not found')
    const base = slugify(file.name.replace(/\.[^.]*$/, '')) || 'image'
    const name = `${base}-${(await sha1hex(file.bytes)).slice(0, 6)}.${ext}`
    await this.commit({ from: slug, to: slug, changes: [{ path: `${this.mediaPath(slug)}/${name}`, content: b64encode(file.bytes), encoding: 'base64' }], message: `Draft: image for ${slug}` })
    return { src: `/media/${slug}/${name}`, width: file.width, height: file.height, bytes: file.bytes.length, converted: file.converted }
  }

  /* ------------------------------------------------------------------- ship */

  /** The repo's own guards, for this post: schema, slug rules and uniqueness, parent on main, no em or en dashes. */
  async shipProblems(slug: string, raw: string): Promise<string[]> {
    const { frontmatter: fm } = parsePost(raw, slug)
    const problems: string[] = []
    const schema = frontmatterProblem(slug, fm)
    if (schema) problems.push(schema)
    const sp = slugProblem(fm.slug)
    if (sp) problems.push(sp)
    const { posts } = await this.list()
    const clash = posts.find((p) => p.id !== slug && p.source?.onMain && p.slug === fm.slug)
    if (clash) problems.push(`slug "${fm.slug}" is already used by ${clash.id}.md`)
    if (fm.parent && !posts.some((p) => p.id === fm.parent && p.source?.onMain)) problems.push(`parent project "${fm.parent}" is not on main yet`)
    const dashes = dashLines(raw)
    if (dashes.length) problems.push(`em or en dash on line${dashes.length > 1 ? 's' : ''} ${dashes.slice(0, 8).map((d) => d.line).join(', ')} (use a comma, colon, "to" or a hyphen)`)
    return problems
  }

  async ship(slug: string): Promise<ShipResult> {
    assertSlug(slug)
    const s = await this.snapshot(slug)
    if (!s.branchExists || !s.branch?.text) throw new HttpError(400, 'Nothing to ship yet: save a draft first')
    const branch = branchOf(slug)
    const cmp = await this.gh.rest<{ ahead_by: number; files?: { filename: string; status: string }[] }>('GET', `compare/${this.cfg.base}...${branch}`)
    if (!cmp.ahead_by) throw new HttpError(400, `${branch} has no changes against ${this.cfg.base}`)
    const problems = await this.shipProblems(slug, s.branch.text)
    if (problems.length) throw new HttpError(422, `Fix before shipping: ${problems.join('; ')}`, { problems })

    const { frontmatter: fm, body } = parsePost(s.branch.text, slug)
    const title = s.main ? `michal.ai: edit "${fm.title}"` : `michal.ai: new ${fm.kind} "${fm.title}"`
    const path = fm.parent ? `/projects/${fm.parent}/${fm.slug}` : `${fm.kind === 'article' ? '/writing' : '/projects'}/${fm.slug}`
    const files = (cmp.files ?? []).map((f) => `- \`${f.filename}\` (${f.status})`)
    const prBody = [
      'Opened from the hosted editor at write.michal.ai. Merging to main deploys michal.ai.',
      '',
      `- Post: \`${this.postPath(slug)}\` (${fm.kind}, ${fm.draft ? 'draft: stays off the site after merge' : 'published'})`,
      ...(fm.draft ? [] : [`- Live after merge: ${this.cfg.siteOrigin}${path}`]),
      `- ${countWords(body).toLocaleString('en-US')} words`,
      '',
      'Files:',
      ...files,
      '',
      'Checked before opening: front matter schema, slug rules, dash guard. CI runs the full `npm run check`.',
    ].join('\n')

    if (s.pr) {
      await this.gh.rest('PATCH', `pulls/${s.pr.number}`, { title, body: prBody })
      return { url: s.pr.url, number: s.pr.number, created: false }
    }
    const pr = await this.gh.rest<{ html_url: string; number: number }>('POST', 'pulls', { title, head: branch, base: this.cfg.base, body: prBody })
    return { url: pr.html_url, number: pr.number, created: true }
  }
}
