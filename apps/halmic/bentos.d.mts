// Types for bentos.mjs, for the editor in the content repo (TypeScript). The build itself is plain JavaScript.
export type Size = 'one' | 'w2' | 'x4' | 'lead';
export type Tile = { id: string; size: Size; label: string; required?: boolean; innerOnly?: boolean };
export type Flex = { id: string; size: null; label: string; required?: boolean };
export type Cluster = { name: string; tiles: Tile[]; flex: Flex | null; fixed?: boolean; needsTiles?: boolean };
export type Section = { id: string; title: string; anchor?: boolean; clusters: string[] };
export type Content = { videos: any; exclude: any; curation: any; games: any; posts: any; mountaintop?: any; phoenix?: any };
export type Model = { sections: Section[]; clusters: Record<string, Cluster>; data: any };
export const SIZES: Record<Size, [number, number, number]>;
export const SIZE_CLS: Record<Size, string>;
export const COLS: [4, 3, 2];
export function derive(content: Content): any;
export function model(content: Content): Model;
export function cells(tiles: { size: Size }[]): number[];
export function gaps(tiles: { size: Size }[]): number[];
