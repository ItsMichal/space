export type PageLink = { token: string; label: string; expires?: string; revoked?: true }
export type PageData = { title: string; description?: string; date?: string; expires?: string; disabled?: true; links: PageLink[] }

export declare const PAGES: { bytes: number; title: number; description: number; label: number; links: number; idLength: number }
export declare const PAGE_TOKEN_RE: RegExp
export declare function pageIdProblem(id: unknown): string | null
export declare function parsePageData(data: unknown): { page: PageData; problem?: undefined } | { page?: undefined; problem: string }
export declare function pageProblems(raw: string, data: unknown, body: string): string[]
export declare function pageTokenClashes(pages: { id: string; page: PageData }[]): string[]
export declare function linkUntil(page: PageData, link: PageLink): string | null
export declare function linkOpen(until: string | null | undefined, now?: Date): boolean
