// Types for ./rules.mjs (plain JavaScript so the content repo can run it on its own).
import type { PostFrontmatter } from './types'

export declare const LIMITS: {
  postBytes: number
  mediaBytes: number
  title: number
  description: number
  shortText: number
  tags: number
  tag: number
  links: number
  gallery: number
  url: number
}
export declare const STRICT_SLUG_RE: RegExp
export declare function slugProblem(slug: string): string | null
export declare const DASH_RE: RegExp
export declare function dashLines(text: string): { line: number; text: string }[]
export declare function safeHref(url: unknown): boolean
export declare function safeImageSrc(url: unknown): boolean
export declare function mediaPathOk(p: unknown): boolean
export declare const EMBED_HOSTS: string[]
export declare function embedUrlOk(url: unknown): boolean
export declare const YOUTUBE_ID_RE: RegExp
export declare const CALLOUT_TYPES: string[]
export declare const RATIO_RE: RegExp
export declare const DIRECTIVES: Record<string, string[]>
export declare function directiveAttrs(name: string, attrs: Record<string, unknown> | undefined | null): Record<string, string> | null
export declare function frontmatterProblem(id: string, fm: PostFrontmatter): string | null
export declare function bodyProblems(body: string): string[]
export declare const MEDIA_TYPES: Record<string, string>
export declare function sniffMedia(bytes: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | 'avif' | 'mp4' | 'webm' | null
export declare const MEDIA_NAME_RE: RegExp
export declare function mediaProblem(dir: string, name: string, bytes: Uint8Array): string | null
export declare const SAFE_MATTER: { engines: Record<string, () => never> }
export declare function rawPostProblem(raw: string): string | null
export declare const HANDWRITING: {
  duration: [number, number]
  blur: [number, number]
  chroma: [number, number]
  stagger: [number, number]
  focus: [number, number]
  ease: string[]
  color: string[]
}
export declare const HANDWRITING_SRC_RE: RegExp
export declare function handwritingNumber(key: string, value: unknown): string | null
export declare function handwritingSources(body: string): { line: number; src: string }[]
export type Ink = { version: 1; width: number; height: number; size: number; pressure: boolean; strokes: number[][] }
export declare const INK: {
  bytes: number
  side: [number, number]
  size: [number, number]
  strokes: number
  points: number
  totalPoints: number
  time: number
}
export declare const INK_NAME_RE: RegExp
export declare function parseInk(input: Uint8Array | string): { ink: Ink; problem?: undefined } | { ink?: undefined; problem: string }
export declare function inkProblem(input: Uint8Array | string): string | null
