// Browser-side wrappers for /api/write/*. Throws ApiError with the server's message.
import type { PostKind } from '@/lib/content/types'
import type { PostFile, PostStatus, PostSummary, SaveInput, SaveResult, ShipResult, UploadResult } from '@/lib/editor/wire'
import { editorHost } from './host'
import { prepareImage } from './image'

export type { SaveResult }
export type LoadedPost = PostFile

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText, data)
  return data as T
}

// Writes run one at a time. In the hosted editor each one is a commit on the same branch, and two in flight would race for the ref.
let tail: Promise<unknown> = Promise.resolve()
function serial<T>(run: () => Promise<T>): Promise<T> {
  const next = tail.then(run, run)
  tail = next.catch(() => {})
  return next
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  list: () => call<{ posts: PostSummary[]; tags: string[] }>('/api/write/posts'),
  create: (input: { title?: string; kind?: PostKind }) => serial(() => call<LoadedPost>('/api/write/posts', jsonInit('POST', input))),
  read: (id: string) => call<LoadedPost>(`/api/write/posts/${id}`),
  save: (id: string, input: SaveInput) => serial(() => call<SaveResult>(`/api/write/posts/${id}`, jsonInit('PUT', input))),
  trash: (id: string) => serial(() => call<{ trashed: string }>(`/api/write/posts/${id}`, { method: 'DELETE' })),
  rename: (id: string, newSlug: string) => serial(() => call<LoadedPost>(`/api/write/posts/${id}/rename`, jsonInit('POST', { newSlug }))),
  upload: async (slug: string, file: File) => {
    const form = new FormData()
    form.set('slug', slug)
    if (editorHost().hosted) {
      // The Worker cannot run sharp, so the browser applies the same size rules before the bytes are committed.
      const img = await prepareImage(file)
      form.set('file', img.file)
      form.set('width', String(img.width))
      form.set('height', String(img.height))
      form.set('converted', img.converted ? '1' : '')
    } else form.set('file', file)
    return serial(() => call<UploadResult>('/api/write/upload', { method: 'POST', body: form }))
  },
  /** Hosted only: the post's editor branch and pull request. */
  status: (id: string) => call<PostStatus>(`/api/write/posts/${id}/status`),
  /** Hosted only: open (or update) the pull request for the post's branch. */
  ship: (id: string) => serial(() => call<ShipResult>(`/api/write/posts/${id}/ship`, { method: 'POST' })),
}
