export type RedirectEntry = { from: string[]; key?: string }
export type RedirectMap = Record<string, RedirectEntry>
export type PostPath = { slug: string; kind: 'article' | 'project'; parent?: string; path: string }
export function readRedirectMap(root?: string): RedirectMap
export function readPostPaths(root?: string): PostPath[]
export function buildRedirects(
  map?: RedirectMap,
  posts?: PostPath[],
): { source: string; destination: string; permanent: true }[]
