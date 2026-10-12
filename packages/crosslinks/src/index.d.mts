export type Mark = { viewBox: string; paths: string[] }
export type Pair = { relation: 'project' | 'log'; post: string; halmic: string; halmicTitle: string; michalTitle: string | null }
export type PostRef = { id?: string; slug: string; kind: 'article' | 'project'; parent?: string }
export const MICHAL_ORIGIN: string
export const HALMIC_ORIGIN: string
export const MICHAL_DOMAIN: string
export const HALMIC_DOMAIN: string
export const PAIRS: Pair[]
export const M_MARK: Mark
export const H_MARK: Mark
export function markSvg(mark: Mark, cls?: string): string
export function pairForPost(postId: string): Pair | undefined
export function pairForHalmicPath(path: string): Pair | undefined
export function postPath(post: PostRef): string
export function michalPathFor(postId: string, posts: PostRef[]): string | undefined
export function halmicLinkFor(postId: string): { href: string; domain: string; title: string } | undefined
export function michalLinkFor(halmicPath: string, posts: PostRef[]): { href: string; domain: string; title: string | null } | undefined
export const FOR_HALMIC: { origin: string; domain: string; mark: Mark; pairLink: typeof michalLinkFor }
export const FOR_MICHAL: { origin: string; domain: string; mark: Mark; pairLink: typeof halmicLinkFor }
