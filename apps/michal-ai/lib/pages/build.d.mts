import type { PageData } from '../content/pages.mjs'

export type BuiltPage = { id: string; key: string; page: PageData; body: string }
export type PagesManifest = { links: Record<string, { page: string; key: string; until: string }>; pages: string[] }
export declare const PAGE_STUB_KEY: string
export declare function pagePaths(pages: { key: string }[]): string[]
export declare function pagesDir(root?: string): string
export declare function pageKey(id: string, page: PageData): string
export declare function readPages(root?: string): BuiltPage[]
export declare function pagesManifest(pages: BuiltPage[]): PagesManifest
