// Types for layout.mjs, for the editor in the content repo (TypeScript).
import type { Flex, Model, Size, Tile } from './bentos.mjs';
export type SectionLayout = { id: string; title?: string; hide?: boolean; clusters?: string[] };
export type ClusterLayout = { hide?: boolean; order?: string[]; sizes?: Record<string, Size>; hidden?: string[] };
export type Layout = { version: 1; sections: SectionLayout[]; clusters: Record<string, ClusterLayout> };
export type ResolvedCluster = { id: string; name: string; tiles: Tile[]; flex: Flex | null; required: string[] };
export type ResolvedSection = { id: string; title: string; anchor: boolean; hide: boolean; clusters: ResolvedCluster[] };
export const LAYOUT: { maxBytes: number; maxTitle: number; maxList: number };
export class LayoutError extends Error {}
export function parseLayout(text: string): Layout;
export function isDefault(layout: Layout): boolean;
export function resolve(m: Model, layout: Layout): { sections: ResolvedSection[]; problems: string[] };
export function arrange(m: Model, layout: Layout, cid: string): ResolvedCluster | null;
