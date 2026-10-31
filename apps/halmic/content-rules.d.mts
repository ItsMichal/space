// Types for content-rules.mjs, for the editor in the content repo (TypeScript).
export type FolderFile = { size: number; text?: string };
export type Facts = { videos: any; exclude: { ids: string[] }; games: { games: { slug: string; title: string }[] }; phoenix: any; thumbs: string[] };
export const RULES: { maxPosts: number; maxText: number; maxLine: number; maxAlt: number; maxTitle: number; maxMediaKB: number; maxImagePx: number; maxLogBytes: number; maxLogs: number };
export const POST_KINDS: string[];
export const GAME_TIERS: string[];
export const VIDEO_KINDS: string[];
export const FOLDER_FILE: RegExp;
export function checkPosts(j: unknown, ctx?: { media?: Record<string, number> }): string[];
export function checkCuration(j: unknown, ctx?: { videoIds?: string[]; gameSlugs?: string[] }): string[];
export function checkMountaintop(j: unknown, ctx?: { logs?: Record<string, string>; intro?: string; images?: Record<string, number>; thumbs?: string[] }): string[];
export function checkLayout(text: string, content: Record<string, unknown>): string[];
export function checkFolder(files: Record<string, FolderFile>, facts: Facts & { identity?: (text: string) => { line: number }[] }): string[];
