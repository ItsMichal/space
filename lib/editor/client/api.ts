// Browser-side wrappers for /api/write/*. Throws ApiError with the server's message.
import type { PostFrontmatter, PostKind } from '@/lib/content/types'

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

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export type SaveResult = { hash: string; mtimeMs: number }
export type LoadedPost = { id: string; frontmatter: PostFrontmatter; body: string; hash: string; mtimeMs: number }

export const api = {
  create: (input: { title?: string; kind?: PostKind }) => call<LoadedPost>('/api/write/posts', jsonInit('POST', input)),
  read: (id: string) => call<LoadedPost>(`/api/write/posts/${id}`),
  save: (id: string, input: { frontmatter: PostFrontmatter; body: string; baseHash?: string; force?: boolean }) =>
    call<SaveResult>(`/api/write/posts/${id}`, jsonInit('PUT', input)),
  trash: (id: string) => call<{ trashed: string }>(`/api/write/posts/${id}`, { method: 'DELETE' }),
  rename: (id: string, newSlug: string) => call<LoadedPost>(`/api/write/posts/${id}/rename`, jsonInit('POST', { newSlug })),
  upload: async (slug: string, file: File) => {
    const form = new FormData()
    form.set('slug', slug)
    form.set('file', file)
    return call<{ src: string; width: number; height: number; bytes: number; converted: boolean }>('/api/write/upload', {
      method: 'POST',
      body: form,
    })
  },
}
